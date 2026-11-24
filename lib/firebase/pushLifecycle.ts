"use client";

import { createClient } from "@/lib/supabase/client";
import { FirebaseService } from "@/services/firebase.service";
import { PushTokenService } from "@/services/push-token.service";

export const PUSH_STORAGE_KEY = "student-food:push-registration";
export const PUSH_CHANGED = "student-food:push-changed";
export class PushOwnerChangedError extends Error {}
type Registration = { userId: string; token: string; enabled: boolean };

export function readPushRegistration(): Registration | null {
  const raw = localStorage.getItem(PUSH_STORAGE_KEY);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (typeof value?.userId !== "string" || typeof value?.token !== "string") return null;
  // Dữ liệu cũ chưa có enabled: không tự coi đó là sự đồng ý bật lại.
  return { ...value, enabled: value.enabled === true };
}

function save(value: Registration) {
  // Nếu storage không dùng được, dừng thao tác để không mất dấu token cần cleanup.
  localStorage.setItem(PUSH_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(PUSH_CHANGED));
}

export async function assertPushOwner(userId: string) {
  const { data, error } = await createClient().auth.getUser();
  if (error) throw error;
  if (data.user?.id !== userId) throw new PushOwnerChangedError("Tài khoản đã thay đổi. Vui lòng tải lại trang.");
}

export async function withPushLock<T>(action: () => Promise<T>): Promise<T> {
  // Cùng origin: các tab phải đợi nhau khi bật/tắt/đăng xuất, tránh xóa token đang được tạo.
  if (!navigator.locks) return Promise.reject(new Error("Trình duyệt chưa hỗ trợ đồng bộ thông báo giữa các tab."));
  return await navigator.locks.request("student-food:push-lifecycle", action);
}

// Chỉ gọi khi người dùng đã cho phép, hoặc đã bật trước đó; không tự mở permission prompt.
export async function enablePush(userId: string, automatic = false): Promise<void> {
  // Trình duyệt chưa dùng push: không tạo Firebase app hoặc thêm request auth định kỳ.
  if (automatic && !readPushRegistration()) return Promise.resolve();
  return withPushLock(async () => {
    await assertPushOwner(userId);
    const previous = readPushRegistration();
    if (previous && previous.userId !== userId) {
      // Kể cả B chưa bật push, token của A cũng không được tiếp tục nhận trên máy này.
      if (!await FirebaseService.deleteRegistrationToken()) throw new Error("Chưa thể hủy token của tài khoản trước.");
      save({ userId, token: "", enabled: false });
      if (automatic) return;
    }
    if (automatic && (previous?.userId !== userId || !previous.enabled)) return;
    if (Notification.permission !== "granted") return;
    if (!previous) {
      // Không còn dấu vết local: bỏ token SDK cũ trước khi tạo đăng ký mới.
      if (!await FirebaseService.deleteRegistrationToken()) throw new Error("Chưa thể hủy token của tài khoản trước.");
    }
    const token = await FirebaseService.registerAndGetToken();
    await assertPushOwner(userId);
    // Lưu trước POST: vẫn có thể cleanup nếu server đã lưu nhưng response bị mất.
    save({ userId, token, enabled: true });
    await PushTokenService.register(token, userId);
    await assertPushOwner(userId);
    if (previous?.userId === userId && previous.token && previous.token !== token) {
      await PushTokenService.unregister(previous.token, userId);
    }
  });
}

// Caller giữ lock; unregister khi cookie còn hợp lệ, rồi mới xóa FCM token.
export async function removePushBeforeLogout(userId: string) {
  await assertPushOwner(userId);
  const previous = readPushRegistration();
  if (!previous || previous.userId !== userId) return;
  save({ ...previous, enabled: false });
  if (previous.token) {
    await PushTokenService.unregister(previous.token, userId);
    await assertPushOwner(userId);
    if (!await FirebaseService.deleteRegistrationToken()) throw new Error("Chưa thể hủy token thông báo. Vui lòng thử lại.");
  }
  // Giữ owner để lần đổi account tiếp theo biết phải tạo token mới.
  save({ userId, token: "", enabled: false });
}

export function disablePush(userId: string) {
  return withPushLock(() => removePushBeforeLogout(userId));
}
