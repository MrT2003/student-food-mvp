"use client";

import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { useStudentMockStore } from "./useStudentMockStore";
import type { OrderStatus } from "@/types/order.types";

type Feedback = { userId: string; orderId: string; context: string; state: "checking" | "unknown" | OrderStatus; phone?: string | null };
// Không persist: kết quả chỉ tồn tại trong phiên UI, độc lập với vòng đời nút hủy.
export const useCancellationFeedback = create<{ result: Feedback | null }>(() => ({ result: null }));
useAuthStore.subscribe((auth, previous) => {
  if (auth.user?.id !== previous.user?.id || auth.logoutStatus === "pending") useCancellationFeedback.setState({ result: null });
});

export function showCancellation(orderId: string, userId: string) {
  const order = useStudentMockStore.getState().orderRecords[orderId];
  const result: Feedback = { userId, orderId, state: "checking",
    context: [order?.restaurant?.name, order?.order_items[0]?.item_name_snapshot, order?.order_code].filter(Boolean).join(" · ") };
  useCancellationFeedback.setState({ result });
  return result;
}

export function updateCancellation(result: Feedback, state: Feedback["state"], phone?: string | null) {
  // Response muộn không được ghi đè kết quả đơn khác hoặc lộ dữ liệu sau đổi tài khoản.
  if (useAuthStore.getState().user?.id !== result.userId || useCancellationFeedback.getState().result?.orderId !== result.orderId) return;
  useCancellationFeedback.setState({ result: { ...result, state, phone } });
  if (["accepted", "rejected", "cancelled", "completed"].includes(state)) {
    useStudentMockStore.setState(store => {
      const order = store.orderRecords[result.orderId];
      return order?.student_id === result.userId ? { orderRecords: { ...store.orderRecords,
        [result.orderId]: { ...order, order_status: state as OrderStatus } } } : {};
    });
  }
}

export async function reconcileCancellation(result: Feedback) {
  updateCancellation(result, "checking");
  // Tối đa ba lần đọc. Pending sau lỗi mạng chưa chứng minh POST đã thất bại.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    if (useAuthStore.getState().user?.id !== result.userId || useCancellationFeedback.getState().result?.orderId !== result.orderId) return;
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(result.orderId)}/cancel`, {
        cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (response.ok && data.orderId === result.orderId && ["accepted", "rejected", "cancelled", "completed"].includes(data.status)) {
        updateCancellation(result, data.status, data.phone);
        return;
      }
      if ([401, 403, 404].includes(response.status)) break;
    } catch { /* Giữ trạng thái chưa biết, không suy luận là hủy thất bại. */ }
  }
  updateCancellation(result, "unknown");
}
