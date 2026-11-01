"use client";

import { useForegroundNotifications } from "@/lib/firebase/useForegroundNotifications";
import { useAuthStore } from "@/store/useAuthStore";
import { Bell, X } from "lucide-react";
import Link from "next/link";

function NotificationFeed({ userId }: { userId: string }) {
  const { notifications, error, dismiss, dismissError } = useForegroundNotifications(userId);
  return (
    // Fixed không chiếm chỗ trong layout; live region không giành focus khi message đến.
    <aside aria-label="Thông báo mới" aria-live="polite" aria-relevant="additions"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex max-h-[80dvh] w-[calc(100%_-_2rem)] max-w-sm flex-col gap-3 overflow-y-auto">
      {error && <div className="pointer-events-auto rounded-xl border bg-white p-4 text-sm text-gray-900 shadow-lg">
        <p>{error}</p><button type="button" onClick={dismissError} className="mt-2 underline">Đóng</button>
      </div>}
      {notifications.map((item) => (
        <article key={item.id} className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-orange-200 bg-white p-4 text-gray-900 shadow-xl">
          <Bell size={22} className="mt-1 shrink-0 text-orange-600" aria-hidden="true" />
          <div className="min-w-0 flex-1 break-words">
            {/* React render text an toàn; không render HTML từ nội dung push. */}
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{item.body}</p>
            <Link href={item.href} onClick={() => dismiss(item.id)} className="mt-2 inline-block text-sm font-medium text-orange-700 underline">Xem đơn hàng</Link>
          </div>
          <button type="button" onClick={() => dismiss(item.id)} aria-label={`Đóng thông báo: ${item.title}`}
            className="shrink-0 rounded-lg p-2 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-orange-600">
            <X size={18} aria-hidden="true" />
          </button>
        </article>
      ))}
    </aside>
  );
}

export default function ForegroundNotifications() {
  const userId = useAuthStore((state) => state.user?.id);
  const logoutStatus = useAuthStore((state) => state.logoutStatus);
  if (!userId || logoutStatus === "pending" || logoutStatus === "failed") return null;
  // Đổi user sẽ unmount feed cũ ngay: xóa toast, ID dedupe và listener của tài khoản trước.
  return <NotificationFeed key={userId} userId={userId} />;
}