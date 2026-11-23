"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchInbox, markNotificationRead, useNotificationInbox } from "@/store/useNotificationInbox";

export default function NotificationInboxLifecycle() {
  const userId = useAuthStore(state => state.user?.id);
  const pathname = usePathname();
  const error = useNotificationInbox(state => state.error);
  useEffect(() => {
    if (!userId) return;
    // Không polling. Kiểm tra khi đăng nhập, quay lại tab và quay lại online.
    const refresh = () => { if (document.visibilityState === "visible") void fetchInbox(useNotificationInbox.getState().open); };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => { document.removeEventListener("visibilitychange", refresh); window.removeEventListener("online", refresh); };
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get("readNotification");
    // Link push mang người nhận để không đánh dấu nhầm khi browser đang dùng account khác.
    if (!id || url.searchParams.get("notificationRecipient") !== userId || !/^[0-9a-f-]{36}$/i.test(id)) return;
    void markNotificationRead(id).then(ok => {
      if (!ok || useAuthStore.getState().user?.id !== userId || window.location.href !== url.href) return;
      url.searchParams.delete("readNotification"); url.searchParams.delete("notificationRecipient");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    });
  }, [userId, pathname]);
  if (!userId || !error) return null;
  return <div role="status" className="fixed bottom-24 left-4 right-4 z-[120] mx-auto max-w-md rounded-xl border bg-white p-3 text-sm text-red-700 shadow-lg">
    {error}<button className="ml-3 underline" onClick={() => useNotificationInbox.setState({ error: null })}>Đóng</button>
  </div>;
}
