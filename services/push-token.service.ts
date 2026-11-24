"use client";

export class PushTokenRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

// Lớp gọi API lưu token, tách khỏi FirebaseService (chỉ làm việc với Firebase SDK).
async function updateRegistration(method: "POST" | "DELETE", token: string, expectedUserId: string): Promise<void> {
  const response = await fetch("/api/notifications/tokens", {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Expected-User-Id": expectedUserId },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new PushTokenRequestError(typeof result?.error === "string" ? result.error : "Không thể cập nhật đăng ký thông báo.", response.status);
  }
}

export const PushTokenService = {
  // Gọi sau FirebaseService.registerAndGetToken(); chỉ báo UI thành công khi API đã lưu xong.
  register(token: string, userId: string): Promise<void> { return updateRegistration("POST", token, userId); },
  // Gọi khi session còn hợp lệ, trước khi hủy FCM token và đăng xuất Supabase.
  unregister(token: string, userId: string): Promise<void> { return updateRegistration("DELETE", token, userId); },
};
