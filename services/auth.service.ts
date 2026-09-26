import { getSupabaseClient, getSupabaseConfig } from "@/lib/supabase/client";
import type { AuthProfile, UpdateProfileInput } from "@/types/auth.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const authErrorMessages: Record<string, string> = {
  UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  NOT_ALLOWED: "Bạn không được phép thực hiện thao tác này.",
  ACCOUNT_INACTIVE: "Tài khoản hiện không hoạt động.",
  USER_NOT_FOUND: "Chưa thể tải hồ sơ tài khoản. Vui lòng thử lại.",
  NAME_REQUIRED: "Vui lòng nhập tên của bạn.",
  VALIDATION_ERROR: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
  "23505": "Thông tin này đã được sử dụng bởi tài khoản khác.",
};

export function getAuthErrorMessage(error: unknown): string {
  const outer = isRecord(error) ? error : null;
  const detail = outer && isRecord(outer.error) ? outer.error : outer;

  const code = detail?.code;

  if (typeof code === "string" && authErrorMessages[code]) {
    return authErrorMessages[code];
  }

  if (error instanceof TypeError) {
    return "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.";
  }

  // Giữ thông báo validation do ứng dụng chủ động tạo.
  if (error instanceof Error && !("code" in error)) {
    return error.message;
  }

  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    throw error;
  }
}

export async function getCurrentProfile(): Promise<AuthProfile | null> {
  const supabase = getSupabaseClient();

  // Chờ SDK khôi phục session hoặc xử lý code OAuth trong URL.
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!sessionData.session) {
    return null;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  const { data, error } = await supabase
    .from("users")
    .select("id,role,name,phone,avatar_url,status,work_for_restaurant_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Chưa thể tải hồ sơ tài khoản. Vui lòng thử lại sau.");
  }

  if (data.status !== "active") {
    throw new Error("Tài khoản hiện không hoạt động.");
  }

  return data;
}

export async function updateMyProfile(
  input: UpdateProfileInput,
): Promise<AuthProfile> {
  const name = input.name.trim();
  const phone = input.phone.replace(/[\s().-]/g, "");

  if (!name) {
    throw new Error("Vui lòng nhập tên của bạn.");
  }

  if (!/^\+?\d{9,15}$/.test(phone)) {
    throw new Error("Số điện thoại cần có 9–15 chữ số.");
  }

  const supabase = getSupabaseClient();
  const { url, key } = getSupabaseConfig();

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  const response = await fetch(`${url}/rest/v1/rpc/update_my_profile`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_name: name,
      p_phone: phone,
      p_avatar_url: input.avatarUrl,
    }),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (response.status === 401) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  if (!response.ok || (isRecord(payload) && payload.success === false)) {
    throw new Error(getAuthErrorMessage(payload));
  }

  if (!isRecord(payload) || payload.success !== true) {
    throw new Error("Chưa xác nhận được kết quả lưu hồ sơ. Vui lòng thử lại.");
  }

  const profile = await getCurrentProfile();

  if (!profile?.phone?.trim()) {
    throw new Error("Chưa lưu được số điện thoại. Vui lòng thử lại.");
  }

  return profile;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();

  if (error) {
    throw error;
  }
}

export function subscribeAuthProfile(
  onProfile: (profile: AuthProfile | null) => void,
  onError: (message: string) => void,
): () => void {
  const supabase = getSupabaseClient();

  let stopped = false;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

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
            onError(getAuthErrorMessage(error));
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