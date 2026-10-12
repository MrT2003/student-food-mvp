"use client";

import { createClient } from "@/lib/supabase/client";
import type { AuthProfile, UpdateProfileInput } from "@/types/auth.types";

// Define error message
const authErrorMessages: Record<string, string> = {
  UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  NOT_ALLOWED: "Bạn không được phép thực hiện thao tác này.",
  ACCOUNT_INACTIVE: "Tài khoản hiện không hoạt động.",
  USER_NOT_FOUND: "Chưa thể tải hồ sơ tài khoản. Vui lòng thử lại.",
  NAME_REQUIRED: "Vui lòng nhập tên của bạn.",
  VALIDATION_ERROR: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
  "23505": "Thông tin này đã được sử dụng bởi tài khoản khác.",
};

// Create an AuthClientService module
export const AuthClientService = {
  isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  },

  // Sign out function
  async signOut(): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },

  // Login with google function
  async signInWithGoogle(next: string = "/"): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/google/callback?next=${encodeURIComponent(next)}`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) {
      throw error;
    }
  },

  singInWithZalo(): void {
    window.location.assign("/api/auth/zalo/login");
  },

  getAuthErrorMessage(error: unknown): string {
    const outer = AuthClientService.isRecord(error) ? error : null;
    const detail =
      outer && AuthClientService.isRecord(outer.error) ? outer.error : outer;

    const code = detail?.code;

    if (typeof code === "string" && authErrorMessages[code]) {
      return authErrorMessages[code];
    }

    const message = detail?.message;
    if (typeof message === "string" && authErrorMessages[message]) {
      return authErrorMessages[message];
    }

    if (error instanceof TypeError) {
      return "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.";
    }

    // Giữ thông báo validation do ứng dụng chủ động tạo.
    if (error instanceof Error && !("code" in error)) {
      return error.message;
    }

    return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
  },

  async updateMyProfile(input: UpdateProfileInput): Promise<AuthProfile> {
    const name = input.name.trim();
    const phone = input.phone.replace(/[\s().-]/g, "");

    if (!name) {
      throw new Error("Vui lòng nhập tên của bạn.");
    }

    if (!/^\+?\d{9,15}$/.test(phone)) {
      throw new Error("Số điện thoại cần có 9–15 chữ số.");
    }

    const supabase = createClient();

    const { error } = await supabase.rpc("update_my_profile", {
      p_name: name,
      p_phone: phone,
      p_avatar_url: input.avatarUrl ?? null,
    });

    if (error) {
      throw error;
    }

    const updatedProfile = await getCurrentProfile();

    if (!updatedProfile?.phone?.trim()) {
      throw new Error("Chưa lưu được số điện thoại. Vui lòng thử lại.");
    }

    return updatedProfile;
  },
};

export async function getCurrentProfile(): Promise<AuthProfile | null> {
  const supabase = createClient();

  // 1. Kiểm tra session
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!sessionData.session) {
    return null;
  }

  // 2. Lấy thông tin User từ Supabase Auth Engine
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw authError ?? new Error("Không tìm thấy thông tin xác thực.");
  }

  const user = authData.user;
  const meta = user.user_metadata;

  // 3. Trích xuất thông tin Google Metadata làm dữ liệu dự phòng (Fallback)
  const googleName =
    meta?.full_name || meta?.name || user.email?.split("@")[0] || "Người dùng";
  const googleAvatar = meta?.avatar_url || meta?.picture || null;

  // 4. Query thông tin từ bảng `users` trong Database
  const { data, error } = await supabase
    .from("users")
    .select("id,role,name,phone,avatar_url,status,work_for_restaurant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  // 5. Nếu tài khoản đã có trong DB và bị khóa thì mới báo lỗi
  if (data && data.status && data.status !== "active") {
    throw new Error("Tài khoản hiện không hoạt động.");
  }

  // 6. Trả về Profile kết hợp (Ưu tiên dữ liệu trong DB, nếu rỗng thì dùng dữ liệu Google)
  return {
    id: user.id,
    role: data?.role ?? "student",
    name: data?.name || googleName,
    phone: data?.phone || user.phone || "",
    avatar_url: data?.avatar_url || googleAvatar,
    status: data?.status ?? "active",
    work_for_restaurant_id: data?.work_for_restaurant_id ?? null,
    authProviders: [
      ...(user.identities?.some((identity) => identity.provider === "google")
        ? ["google" as const] : []),
      // The custom Zalo callback creates Auth accounts with this email format.
      ...(/^\d+@zalo\.app$/i.test(user.email ?? "")
        ? ["zalo" as const] : []),
    ],
  };
}

export function subscribeAuthProfile(
  onProfile: (profile: AuthProfile | null) => void,
  onError: (message: string) => void,
): () => void {
  let stopped = false;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const supabase = createClient();

  function scheduleReload() {
    const currentRevision = ++revision;

    if (timer !== undefined) {
      clearTimeout(timer);
    }

    // Không gọi các hàm auth bất đồng bộ trực tiếp
    // bên trong callback onAuthStateChange.
    timer = setTimeout(() => {
      void getCurrentProfile()
        .then((profile) => {
          if (!stopped && currentRevision === revision) {
            onProfile(profile);
          }
        })
        .catch((error: unknown) => {
          if (!stopped && currentRevision === revision) {
            onError(AuthClientService.getAuthErrorMessage(error));
          }
        });
    }, 0);
  }

  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (stopped) return;

    if (event === "SIGNED_OUT") {
      revision++;

      if (timer !== undefined) {
        clearTimeout(timer);
      }

      onProfile(null);
      return;
    }

    scheduleReload();
  });

  scheduleReload();

  return () => {
    stopped = true;
    revision++;

    if (timer !== undefined) {
      clearTimeout(timer);
    }

    data.subscription.unsubscribe();
  };
}

