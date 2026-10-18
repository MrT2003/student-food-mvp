import type { ZaloProfileResponse } from "@/types/auth.types";
import { AuthUtilities } from "@/utilities/auth.utility";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import "server-only";

export const ZaloAccountService = {
  // Kiểm tra Google identity do Supabase Auth quản lý.
  hasGoogleIdentity(user: User) {
    return user.identities?.some(identity => identity.provider === "google") ?? false;
  },

  // Chỉ gọi khi liên kết: RPC kiểm tra chủ sở hữu và không tự gộp hai UUID.
  async linkZaloAccount(supabaseAdmin: SupabaseClient, zaloId: string, userId: string) {
    const { error } = await supabaseAdmin.rpc("link_zalo_identity", { p_zalo_id: zaloId, p_user_id: userId });
    if (error) throw error;
  },

  // Tìm mapping trước, email Zalo sau; đăng nhập bình thường không thử insert để dò user.
  async findUser(supabaseAdmin: SupabaseClient, zaloId: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin.rpc("find_zalo_user", { p_zalo_id: zaloId });
    if (error) throw error;
    if (data !== null && typeof data !== "string") throw new Error("INVALID_AUTH_RESPONSE");
    return data;
  },

  // Kiểm tra profile có đang active bằng hàm riêng vì đăng nhập / đăng kí độc lập không gọi RPC link nữa.
  async assertActiveProfile(supabaseAdmin: SupabaseClient, userId: string) {
    const { data, error } = await supabaseAdmin.from("users").select("status").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("PROFILE_NOT_FOUND");
    if (data.status !== "active") throw new Error("ACCOUNT_INACTIVE");
  },

  // Cấp session cho đúng UUID; token chỉ dùng ở server, không gửi mail hoặc đổi password.
  async issueSession(supabaseAdmin: SupabaseClient, sessionClient: SupabaseClient, userId: string) {
    // Check user có đang active không
    await ZaloAccountService.assertActiveProfile(supabaseAdmin, userId);
    // Lấy data từ auth.users có userId = giá trị trong  parameter 
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    // Nếu không có data tương ứng ---> Trả về lỗi 
    if (error || !data.user?.email) throw error ?? new Error("USER_NOT_FOUND");
    // Tạo ra đường magicLink để server tạo session cho người dùng 
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink", email: data.user.email,
    });
    // Nếu tạo magicLink lỗi ---> Trả về lỗi 
    if (linkError || link.user?.id !== userId || !link.properties?.hashed_token) {
      throw linkError ?? new Error("AUTH_ACCOUNT_MISMATCH");
    }
    // Xác minh magicLink bằng hàm verifyOtp ---> Tạo session hợp lệ cho phiên đăng nhập 
    // bằng Zalo 
    const { data: session, error: sessionError } = await sessionClient.auth.verifyOtp({
      type: "magiclink", token_hash: link.properties.hashed_token,
    });
    // Nếu tạo session bị lỗi ---> Trả về lỗi 
    if (sessionError || session.user?.id !== userId) {
      await sessionClient.auth.signOut({ scope: "local" });
      throw sessionError ?? new Error("AUTH_ACCOUNT_MISMATCH");
    }
  },

  // OAuth phải được xác minh trước: tìm/tạo Auth user, tạo profile còn thiếu rồi cấp session.
  async loginWithVerifiedZalo(supabaseAdmin: SupabaseClient, sessionClient: SupabaseClient, profile: ZaloProfileResponse) {
    if (!AuthUtilities.validateZaloID(profile.id)) throw new Error("INVALID_ZALO_ID");
    const zaloEmail = `${profile.id}@zalo.app`;

    // 1. Ưu tiên mapping; nếu chưa liên kết thì RPC tìm tài khoản qua email Zalo.
    let userId = await ZaloAccountService.findUser(supabaseAdmin, profile.id);
    if (!userId) {
      // 2. Tạo Auth user trước. Password random chỉ tạo một lần, không dùng để đăng nhập.
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: zaloEmail,
        password: randomBytes(48).toString("base64url"),
        email_confirm: true,
        app_metadata: { zalo_id: profile.id },
        user_metadata: { name: profile.name, avatar_url: profile.img_url || null },
      });
      if (error) {
        // Request khác có thể vừa tạo/liên kết cùng Zalo ID. Chỉ tiếp tục nếu tìm được user.
        userId = await ZaloAccountService.findUser(supabaseAdmin, profile.id);
        if (!userId) throw error;
      } else {
        userId = data.user?.id ?? null;
      }
    }
    if (!userId) throw new Error("USER_NOT_FOUND");

    // 3. Kiểm tra profile cả với user cũ: lần đăng ký trước có thể tạo Auth thành công
    // nhưng insert public.users thất bại. Lần đăng nhập này sẽ hoàn tất bước còn thiếu.
    const { data: existingProfile, error: profileReadError } = await supabaseAdmin
      .from("users").select("id").eq("id", userId).maybeSingle();
    if (profileReadError) throw profileReadError;

    if (!existingProfile) {
      // Chỉ tạo bù profile của tài khoản Zalo độc lập; không tạo/reset profile Google được ánh xạ.
      const { data: auth, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authError || !auth.user) throw authError ?? new Error("USER_NOT_FOUND");
      if (auth.user.email !== zaloEmail || ZaloAccountService.hasGoogleIdentity(auth.user)) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      // Dùng admin vì chưa cấp session; sessionClient lúc này có thể chưa đăng nhập
      // hoặc vẫn thuộc một user khác. ON CONFLICT DO NOTHING xử lý hai callback đồng thời,
      // không ghi đè name, role hoặc status của profile đã được request khác tạo.
      const { error: profileError } = await supabaseAdmin.from("users").upsert({
        id: userId,
        role: "student",
        status: "active",
        name: profile.name,
        avatar_url: profile.img_url || null,
      }, { onConflict: "id", ignoreDuplicates: true });
      if (profileError) {
        // Hai API không có transaction chung. Giữ Auth user để lần sau tạo bù profile;
        // không xóa bù vì request khác có thể đang dùng chính user này.
        throw profileError;
      }
    }

    // 4. Chỉ cấp session sau khi profile tồn tại và active; không insert bảng mapping.
    await ZaloAccountService.issueSession(supabaseAdmin, sessionClient, userId);
  },

  // Trước OAuth chỉ kiểm tra điều kiện; chưa ghi mapping khi Google chưa liên kết thành công.
  async prepareGoogleLink(supabaseAdmin: SupabaseClient, user: User) {
    // Kiểm tra xem tài khoản của user có đang active không 
    await ZaloAccountService.assertActiveProfile(supabaseAdmin, user.id);
    // Kiểm tra tài khoản người dùng đã link với google hay chưa 
    // Nếu link rồi thì ném lỗi thông báo đã link tài khoản với google rồi 
    if (ZaloAccountService.hasGoogleIdentity(user)) throw new Error("GOOGLE_ALREADY_LINKED");
    // Nếu chưa link tài khoản với google thì kiểm tra trong bản user_zalo_identities có 
    // lưu thông tin zaloID chưa 
    const { data, error } = await supabaseAdmin.from("user_zalo_identities")
      .select("zalo_id").eq("user_id", user.id).maybeSingle();
    // Nếu có lỗi DB ---> Trả về lỗi 
    if (error) throw error;
    // Gán zaloId = giá trị zalo_id trả về trong data hoặc là extract từ email 
    const zaloId = data?.zalo_id ?? user.email?.match(/^(\d{1,64})@zalo\.app$/)?.[1];
    // Nếu không extract được zaloId ---> Chưa link với tài khoản Zalo 
    if (!zaloId) throw new Error("ZALO_ACCOUNT_REQUIRED");
    // Mapping sẽ được ghi ở completeGoogleLink sau callback Google thành công.
  },

  // Hoàn tất mapping + email trong một transaction; Google-only chỉ đồng bộ email.
  async completeGoogleLink(supabaseAdmin: SupabaseClient, userId: string) {
    const { error } = await supabaseAdmin.rpc("complete_google_link", { p_user_id: userId });
    if (error) throw error;
  },
};
