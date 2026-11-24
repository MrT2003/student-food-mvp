"use client";

import { useRef, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { showCancellation, updateCancellation, reconcileCancellation, useCancellationFeedback } from "@/store/useCancellationFeedback";

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const [pending, setPending] = useState(false);
  const feedback = useCancellationFeedback(state => state.result);
  const lock = useRef(false);
  const checking = feedback?.state === "checking";
  async function cancel() {
    if (lock.current || checking || !window.confirm("Bạn muốn hủy đơn đang chờ xác nhận này?")) return;
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    lock.current = true; setPending(true);
    const result = showCancellation(orderId, userId);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (response.ok && data.success === true && data.order_id === orderId && data.order_status === "cancelled") {
        // Kết quả nằm ngoài nút nên vẫn còn khi card chuyển sang lịch sử.
        updateCancellation(result, "cancelled");
      } else {
        await reconcileCancellation(result);
      }
    } catch {
      // Timeout không có nghĩa transaction thất bại: chỉ đọc lại, không tự POST lại.
      await reconcileCancellation(result);
    } finally { lock.current = false; setPending(false); }
  }
  return <button type="button" disabled={pending || checking} onClick={() => void cancel()}
    className="rounded-xl border border-red-300 px-4 py-3 font-medium text-red-700 disabled:opacity-50">
    {pending || checking ? "Đang kiểm tra…" : "Hủy đơn"}
  </button>;
}
