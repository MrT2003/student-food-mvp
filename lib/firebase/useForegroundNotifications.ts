"use client";

import { useEffect, useState } from "react";
import { FirebaseService } from "@/services/firebase.service";
import { useAuthStore } from "@/store/useAuthStore";
import { PUSH_CHANGED, PUSH_STORAGE_KEY, readPushRegistration } from "./pushLifecycle";

export type ForegroundNotification = { id: string; title: string; body: string; href: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Chỉ nhận message; không xin quyền, không tạo token và không gọi API đăng ký lại.
export function useForegroundNotifications(userId: string) {
  const [notifications, setNotifications] = useState<ForegroundNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    // Giữ tối đa 200 ID trong vòng đời listener, kể cả toast đã đóng; tránh tăng bộ nhớ vô hạn.
    const seen = new Set<string>();
    const canReceive = () => {
      const auth = useAuthStore.getState();
      if (auth.user?.id !== userId || ["pending", "failed"].includes(auth.logoutStatus)) return false;
      try {
        const saved = readPushRegistration();
        return saved?.userId === userId && saved.enabled && Boolean(saved.token);
      } catch { return false; }
    };
    const clearIfDisabled = () => { if (!canReceive()) setNotifications([]); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === PUSH_STORAGE_KEY || event.key === null) clearIfDisabled();
    };
    window.addEventListener(PUSH_CHANGED, clearIfDisabled);
    window.addEventListener("storage", onStorage);

    void (async () => {
      if (!await FirebaseService.isBrowserSupported() || disposed) return;
      const stop = await FirebaseService.onForegroundMessage((payload) => {
        if (disposed || document.visibilityState !== "visible" || !canReceive()) return;
        const data = payload.data;
        // Message đang trên đường tới khi đổi account phải bị bỏ qua, không hiện dữ liệu user cũ.
        if (!data || data.recipientUserId !== userId) return;
        const id = data.notificationId || payload.messageId;
        if (!id || id.length > 256 || seen.has(id)) return;
        seen.add(id);
        if (seen.size > 200) seen.delete(seen.values().next().value!);
        const notification: ForegroundNotification = {
          id,
          title: (data.title?.trim() || payload.notification?.title || "StudentFood").slice(0, 120),
          body: (data.body || payload.notification?.body || "Bạn có thông báo mới.").slice(0, 500),
          // Chỉ tạo đường dẫn nội bộ từ UUID, không điều hướng tới URL tùy ý trong payload.
          href: data.orderId && UUID.test(data.orderId) ? `/orders/${data.orderId}` : "/orders",
        };
        setNotifications((current) => [...current, notification].slice(-3));
      });
      // SDK import bất đồng bộ có thể hoàn tất sau unmount/Strict Mode cleanup.
      if (disposed) stop(); else unsubscribe = stop;
    })().catch(() => {
      if (!disposed) setError("Chưa thể nhận thông báo trong trang. Vui lòng tải lại để thử lại.");
    });

    return () => {
      disposed = true;
      unsubscribe?.();
      window.removeEventListener(PUSH_CHANGED, clearIfDisabled);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId]);

  return { notifications, error,
    dismiss: (id: string) => setNotifications((current) => current.filter((item) => item.id !== id)),
    dismissError: () => setError(null) };
}