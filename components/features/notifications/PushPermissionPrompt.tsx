"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { usePushNotifications } from "@/lib/firebase/usePushNotifications";
import { readPushRegistration } from "@/lib/firebase/pushLifecycle";

function AndroidPrompt({ userId }: { userId: string }) {
  const push = usePushNotifications();
  const dialog = useRef<HTMLDialogElement>(null);
  const [eligible, setEligible] = useState(false);
  const [opened, setOpened] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const key = `student-food:push-invite:${userId}`;

  useEffect(() => {
    // UA chỉ chọn UX; hỗ trợ thật được hook Firebase kiểm tra trước khi mở modal.
    if (!/Android/i.test(navigator.userAgent) || !window.isSecureContext) return;
    const check = () => {
      try {
        const saved = readPushRegistration();
        const deferredUntil = Number(localStorage.getItem(key) || 0);
        // Tôn trọng cả lựa chọn tắt push trước đó của tài khoản hiện tại.
        setEligible(!(saved?.userId === userId) && !(deferredUntil > Date.now()));
      } catch { setEligible(false); }
    };
    check();
    const storage = (event: StorageEvent) => { if (event.key === key) check(); };
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
  }, [key, userId]);

  const supported = push.status !== "checking" && push.status !== "unsupported";
  const show = !dismissed && supported && (opened || eligible)
    && (opened || push.permission !== "denied")
    && push.status !== "enabled" && !push.installRequired;

  useEffect(() => {
    if (show && !dialog.current?.open) {
      dialog.current?.showModal(); // Native dialog giữ focus trong modal và hỗ trợ Escape.
      setOpened(true);
    } else if (!show) dialog.current?.close();
  }, [show]);

  function later() {
    // Chỉ lưu lựa chọn UX theo user/origin, không lưu token hay quyền truy cập.
    try { localStorage.setItem(key, String(Date.now() + 7 * 24 * 60 * 60 * 1000)); }
    catch { /* Vẫn cho đóng nếu storage bị chặn. */ }
    setDismissed(true);
  }

  // Permission denied từ trước không mở dialog; nếu vừa từ chối thì hiện hướng dẫn tại chỗ.
  return (
    <dialog ref={dialog} aria-labelledby="push-invite-title" aria-describedby="push-invite-description"
      onCancel={(event) => { event.preventDefault(); later(); }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-orange-100 bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/45">
      <h2 id="push-invite-title" className="text-xl font-bold">Nhận cập nhật đơn hàng</h2>
      <p id="push-invite-description" className="mt-3 text-sm text-gray-600">
        Bật thông báo để biết khi quán xác nhận hoặc từ chối đơn, kể cả khi bạn rời trang. Bạn có thể tắt trong Tài khoản bất cứ lúc nào.
      </p>
      {push.permission === "denied" && <p role="status" className="mt-3 text-sm">Bạn đã chặn thông báo. Có thể thay đổi quyền trong cài đặt website của trình duyệt.</p>}
      {push.error && <p role="alert" className="mt-3 text-sm text-red-700">{push.error}</p>}
      {push.status === "enabling" && <p role="status" className="mt-3 text-sm">Đang đăng ký thông báo…</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" autoFocus onClick={later} className="rounded-xl border px-4 py-3">Để sau</button>
        {/* Gọi ngay từ click, không await trước prompt; backend vẫn xác minh session/owner. */}
        <button type="button" onClick={() => void push.enable()}
          disabled={push.pending || push.permission === "denied"}
          className="rounded-xl bg-orange-600 px-4 py-3 font-semibold text-white disabled:opacity-50">Bật thông báo</button>
      </div>
    </dialog>
  );
}

export default function PushPermissionPrompt() {
  const userId = useAuthStore((state) => state.user?.id);
  const logoutStatus = useAuthStore((state) => state.logoutStatus);
  // Đổi account unmount modal cũ; không cho khởi tạo token trong lúc logout.
  if (!userId || logoutStatus === "pending" || logoutStatus === "failed") return null;
  return <AndroidPrompt key={userId} userId={userId} />;
}
