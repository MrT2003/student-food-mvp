"use client";

import { useEffect, useRef, useState } from "react";
import { FirebaseService } from "@/services/firebase.service";
import { useAuthStore } from "@/store/useAuthStore";
import { disablePush, enablePush, PUSH_CHANGED, PUSH_STORAGE_KEY, readPushRegistration } from "./pushLifecycle";

type Status = "checking" | "unsupported" | "idle" | "enabling" | "enabled" | "disabling" | "disabled";

export function usePushNotifications() {
  const userId = useAuthStore((state) => state.user?.id);
  const [status, setStatus] = useState<Status>("checking");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [error, setError] = useState("");
  const [hasRegistration, setHasRegistration] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      if (disposed) return;
      if ("Notification" in window) setPermission(Notification.permission);
      try {
        const saved = readPushRegistration();
        setHasRegistration(saved !== null && saved.userId === userId && Boolean(saved.token));
        // Local xác định lựa chọn của user, không khẳng định server đã lưu thành công.
        if (!busy.current) setStatus(saved !== null && saved.userId === userId && !saved.enabled ? "disabled" : "idle");
      } catch { setError("Không thể đọc cài đặt thông báo trong trình duyệt."); }
    };
    const onStorage = (event: StorageEvent) => { if (event.key === PUSH_STORAGE_KEY) refresh(); };
    FirebaseService.isBrowserSupported().then((supported) => {
      if (disposed) return;
      if (supported && navigator.locks) refresh(); else setStatus("unsupported");
    }).catch(() => { if (!disposed) setStatus("unsupported"); });
    window.addEventListener(PUSH_CHANGED, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      window.removeEventListener(PUSH_CHANGED, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);

  async function change(enabled: boolean) {
    if (busy.current || !userId) return;
    const owner = userId;
    busy.current = true;
    setError("");
    setStatus(enabled ? "enabling" : "disabling");
    try {
      if (enabled) {
        // Xin permission trực tiếp từ click, trước khi đợi lock hay gọi network.
        const granted = await FirebaseService.requestPermission();
        setPermission(granted);
        if (granted !== "granted") { setStatus("idle"); return; }
        await enablePush(owner);
      } else await disablePush(owner);
      if (useAuthStore.getState().user?.id !== owner) return;
      setHasRegistration(enabled);
      setStatus(enabled ? "enabled" : "disabled");
    } catch (reason) {
      if (useAuthStore.getState().user?.id === owner) {
        setStatus("idle");
        setError(reason instanceof Error ? reason.message : "Không thể cập nhật thông báo.");
        try { setHasRegistration(Boolean(readPushRegistration()?.token)); } catch { /* Giữ lỗi gốc. */ }
      }
    } finally { busy.current = false; }
  }

  return { status, permission, error, hasRegistration,
    enable: () => change(true), disable: () => change(false),
    pending: status === "checking" || status === "enabling" || status === "disabling" };
}
