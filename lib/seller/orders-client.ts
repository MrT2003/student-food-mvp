"use client";
import { useAuthStore } from "@/store/useAuthStore";
import { mapSellerOrder } from "./order-contract";
import type { SellerManagedOrder } from "@/types/seller-orders.types";

const messages: Record<string, string> = {
  UNAUTHORIZED: "Vui lòng đăng nhập lại.", ORDER_FORBIDDEN: "Không có quyền xử lý đơn của cửa hàng.",
  RESTAURANT_NOT_FOUND: "Không tìm thấy cửa hàng của bạn.", ORDER_NOT_FOUND: "Không tìm thấy đơn thuộc cửa hàng.",
  ORDERS_SCHEMA_MISMATCH: "Cấu trúc hoặc quyền đọc dữ liệu đơn chưa khớp. Cần nhóm DB kiểm tra.",
  ORDERS_READ_FAILED: "Không tải được danh sách đơn. Hãy thử tải lại.",
  ORDER_CONFLICT: "Đơn đã được xử lý ở nơi khác hoặc không còn chờ xác nhận. Danh sách sẽ được tải lại.",
  ORDER_RPC_UNAVAILABLE: "RPC accept_order/reject_order chưa sẵn sàng. Chưa thể xử lý đơn.",
  VALIDATION_ERROR: "Yêu cầu xử lý đơn không hợp lệ.", FORBIDDEN: "Nguồn yêu cầu không hợp lệ.",
  ORDER_APPROVAL_FAILED: "Không xử lý được đơn. Hãy đọc lại trạng thái trước khi thử lại.",
};
export class SellerOrderClientError extends Error {
  constructor(public readonly code: string, public readonly status?: number) { super(messages[code] ?? "Chưa xác định kết quả. Hãy tải lại trạng thái trước khi thử lại."); }
}
export function isOrderAccessDenied(error: unknown): boolean {
  const failure = error as { status?: number; code?: string } | null;
  return !!failure && (failure.status === 401 || failure.status === 403 ||
    ["UNAUTHORIZED", "ORDER_FORBIDDEN", "ACCOUNT_CHANGED", "RESTAURANT_NOT_FOUND"].includes(failure.code ?? ""));
}
function actorIsCurrent(actor: string) {
  const user = useAuthStore.getState().user;
  if (user?.id !== actor || !["seller", "staff"].includes(user.role) || user.status !== "active") throw new SellerOrderClientError("ACCOUNT_CHANGED");
}
const path = (id: string) => `/api/seller/restaurants/${encodeURIComponent(id)}/orders`;
async function request(actor: string, url: string, method: "GET" | "POST", signal?: AbortSignal) {
  actorIsCurrent(actor);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  try {
    const response = await fetch(url, { method, credentials: "same-origin", cache: "no-store", signal: controller.signal,
      ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: "{}" } : {}) });
    const data = await response.json().catch(() => null);
    actorIsCurrent(actor);
    if (!response.ok) throw new SellerOrderClientError(data?.error?.code ?? "ORDER_RESULT_UNKNOWN", response.status);
    return data;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
export async function readSellerOrders(actor: string, restaurantId: string, signal?: AbortSignal): Promise<SellerManagedOrder[]> {
  try {
    const data = await request(actor, path(restaurantId), "GET", signal);
    if (!Array.isArray(data?.orders)) throw Error("INVALID_ORDER_DATA");
    return data.orders.map((row: unknown) => mapSellerOrder(row, restaurantId));
  } catch (error) {
    if (error instanceof SellerOrderClientError && (error.code !== "ORDER_RESULT_UNKNOWN" || isOrderAccessDenied(error))) throw error;
    throw Error("Không tải được danh sách đơn. Hãy thử tải lại.");
  }
}
export async function decideSellerOrder(actor: string, restaurantId: string, orderId: string, action: "accept" | "reject" | "complete") {
  const expected = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "completed";
  const initialStatus = action === "complete" ? "accepted" : "pending";
  try {
    const data = await request(actor, `/api/orders/${encodeURIComponent(orderId)}/${action}`, "POST");
    if (data?.order?.id !== orderId || data.order.restaurant_id !== restaurantId || data.order.order_status !== expected)
      throw new SellerOrderClientError("ORDER_RESULT_UNKNOWN");
    return { recovered: false };
  } catch (error) {
    if (error instanceof SellerOrderClientError && messages[error.code]) throw error;
    actorIsCurrent(actor);
    // Timeout/response sai có thể xảy ra sau commit: chỉ GET đúng đơn, không POST lại.
    let order: SellerManagedOrder;
    try {
      const data = await request(actor, `${path(restaurantId)}/${encodeURIComponent(orderId)}`, "GET");
      order = mapSellerOrder(data?.order, restaurantId);
      if (order.id !== orderId) throw Error("INVALID_ORDER_DATA");
    } catch { throw new SellerOrderClientError("ORDER_RESULT_UNKNOWN"); }
    if (order.order_status === expected) return { recovered: true };
    throw new SellerOrderClientError(order.order_status === initialStatus ? "ORDER_RESULT_UNKNOWN" : "ORDER_CONFLICT");
  }
}
