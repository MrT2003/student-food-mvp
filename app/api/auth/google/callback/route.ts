// Tạo JSON response hoặc redirect của Next.js.
import { NextResponse } from "next/server";
// Đọc và thay đổi cookie trong route chạy trên server.
import { cookies } from "next/headers";
// Supabase client gắn với session/cookie người dùng.
import { createClient } from "@/lib/supabase/server";
// Admin client chỉ dùng server để truy cập dữ liệu được bảo vệ.
import { createAdminClient } from "@/lib/supabase/admin";
// Nghiệp vụ tài khoản và đồng bộ email liên hệ.
import { ZaloAccountService } from "@/services/zalo-account.service";
// Tên cookie và helper xác minh ý định liên kết đã ký tên.
import { GOOGLE_LINK_COOKIE, readGoogleLink } from "@/lib/auth/google-link-flow";

// Nhận callback từ Supabase sau quá trình Google OAuth.
export async function GET(request: Request) {
  // Phân tích URL và query string callback.
  const url = new URL(request.url);
  // mode=link là liên kết; nhánh còn lại là đăng nhập Google thông thường.
  const linking = url.searchParams.get("mode") === "link";
  // Helper trả redirect về ứng dụng.
  const redirect = (path: string) => {
    // Dựng URL đích từ đường dẫn và origin hiện tại.
    const response = NextResponse.redirect(new URL(path, url.origin));
    // Không cho cache kết quả xác thực.
    response.headers.set("Cache-Control", "no-store");
    // Trả redirect đã cấu hình.
    return response;
  };
  // Tạo client đọc session hiện tại và ghi cookie khi nhận session mới.
  const supabaseServerClient = await createClient();
  // Lấy cookie store để đọc và tiêu thụ ý định liên kết.
  const jar = await cookies();
  // UUID phải giữ nguyên khi link; đăng nhập thông thường không cần UUID cũ.
  let expectedUser: string | null = null;
  // Bắt đầu nhóm thao tác có thể phát sinh lỗi.
  try {
    // Chỉ nhánh link cần kiểm tra tài khoản đã khởi tạo thao tác.
    // Nếu request gửi tới có mode = link ( Người dùng yêu cầu link thêm với Google như phương thức đăng nhập thứ 2 )
    if (linking) {
      // Cookie ký tên + nonce ràng buộc callback với user đã bấm liên kết.
      // Xác minh chữ ký, thời hạn và nonce của cookie; sai thì nhận null.
      expectedUser = readGoogleLink(jar.get(GOOGLE_LINK_COOKIE)?.value, url.searchParams.get("intent"));
      // Tiêu thụ intent cookie, không dùng lại cho callback sau.
      jar.delete(GOOGLE_LINK_COOKIE);
      // Xác minh user hiện tại với Supabase Auth.
      const { data, error } = await supabaseServerClient.auth.getUser();
      // Cookie/session không khớp: dừng trước khi đổi code.
      if (!expectedUser || error || data.user?.id !== expectedUser) return redirect("/account?google_link=session_changed");
    }
    // Code do Supabase trả cho app để đổi session, không phải access token Google.
    const code = url.searchParams.get("code");
    // Provider báo lỗi hoặc thiếu code thì dừng flow.
    if (url.searchParams.has("error") || !code) {
      // Chọn trang lỗi theo nhánh đăng nhập hoặc liên kết.
      return redirect(linking ? "/account?google_link=failed" : "/auth/auth-code-error");
    }
    // Đổi code cùng PKCE qua Supabase; client lưu session nhận được vào cookies.
    const { data, error } = await supabaseServerClient.auth.exchangeCodeForSession(code);
    // Không nhận được user hợp lệ thì chuyển sang catch ngoài.
    if (error || !data.user) throw error ?? new Error("AUTH_EXCHANGE_FAILED");
    // Nếu người dùng đang gửi request link thêm tài khoản Google vào tài khoản hiện tại, phải bảo đảm 
    // UUID sau exchange phải đúng UUID ban đầu; không tự gộp hai tài khoản.
    if (linking && data.user.id !== expectedUser) {
      // Xóa session cục bộ khi UUID sai hoặc profile không được phép.
      await supabaseServerClient.auth.signOut({ scope: "local" });
      // Báo phiên thay đổi; không tự tháo identity đã link tại Supabase.
      return redirect("/account?google_link=session_changed");
    }
    // Xác nhận user kết quả thực sự có Google identity.
    if (!ZaloAccountService.hasGoogleIdentity(data.user)) throw new Error("GOOGLE_IDENTITY_MISSING");
    // Client đặc quyền phục vụ kiểm tra profile và RPC đồng bộ email.
    const supabaseAdminClient = createAdminClient();
    // Profile được trigger tạo khi đăng ký; callback không upsert/reset trạng thái user.
    // Profile phải tồn tại và active; không tự tạo bù hoặc mở khóa tài khoản.
    try { await ZaloAccountService.assertActiveProfile(supabaseAdminClient, data.user.id); }
    // Profile lỗi: xóa session rồi đưa lỗi ra ngoài.
    catch (error) {
      // Xóa session cục bộ khi UUID sai hoặc profile không được phép.
      await supabaseServerClient.auth.signOut({ scope: "local" });
      // Chuyển lỗi cho catch bên ngoài xử lý.
      throw error;
    }
    // Bắt đầu nhóm thao tác có thể phát sinh lỗi.
    try {
      // RPC kiểm tra Google identity rồi lưu mapping Zalo và contact_email trong cùng transaction.
      await ZaloAccountService.completeGoogleLink(supabaseAdminClient, data.user.id);
    // Xử lý lỗi của khối try tương ứng.
    } catch {
      // Google đã liên kết/đăng nhập thành công; email liên hệ có thể đồng bộ lại riêng.
      // Auth đã thành công nhưng email lỗi; UI cho retry đồng bộ riêng.
      return redirect("/account?google_link=contact_pending");
    }
    // Liên kết và đồng bộ xong, quay về trang tài khoản.
    if (linking) return redirect("/account?google_link=success");
    // Nhánh đăng nhập lấy trang đích, mặc định trang chủ.
    const next = url.searchParams.get("next") ?? "/";
    // Chỉ nhận đường dẫn nội bộ; loại //, dấu gạch chéo ngược và ký tự điều khiển.
    return redirect(next.startsWith("/") && !next.startsWith("//") && !/[\\\x00-\x1f]/.test(next) ? next : "/");
  // Xử lý lỗi của khối try tương ứng.
  } catch {
    // Chọn trang lỗi theo nhánh đăng nhập hoặc liên kết.
    return redirect(linking ? "/account?google_link=failed" : "/auth/auth-code-error");
  }
}
