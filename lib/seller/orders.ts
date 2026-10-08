import type { OrderDetail, OrderStatus } from "@/types/order.types";
import { normalizeSearchText } from "@/lib/format";

// API presentation join, not additional columns on orders.
export type SellerOrder = OrderDetail & { customer: { name: string; phone: string | null } };
export type SellerOrderTab = "pending" | "accepted" | "completed" | "cancelled";
export const sellerTabs: { value: SellerOrderTab; label: string }[] = [
  { value: "pending", label: "Chờ xác nhận" }, { value: "accepted", label: "Đã chấp nhận" },
  { value: "completed", label: "Hoàn thành" }, { value: "cancelled", label: "Đã hủy / từ chối" },
];
export const isInSellerTab = (status: OrderStatus, tab: SellerOrderTab) =>
  status === tab || tab === "cancelled" && status === "rejected";
export const selectedSellerOrder = (visible: SellerOrder[], id: string | null) =>
  id === null ? undefined : visible.find((order) => order.id === id);
export const vietnamDay = (date: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(date));

export function filterSellerOrders(orders: SellerOrder[], restaurantId: string, query: string, day: string | null) {
  const search = normalizeSearchText(query).replace(/^#/, "");
  return orders.filter((order) => order.restaurant_id === restaurantId &&
    (!day || vietnamDay(order.created_at) === day) &&
    (!search || normalizeSearchText(`${order.order_code} ${order.customer.name}`).includes(search)));
}

// UI demo only; backend must authorize restaurant ownership and enforce transitions.
export function transitionSellerOrder(order: SellerOrder, status: OrderStatus, now: string): SellerOrder {
  if (!(order.order_status === "pending" && (status === "accepted" || status === "rejected") ||
      order.order_status === "accepted" && status === "completed")) return order;
  return { ...order, order_status: status,
    accepted_at: status === "accepted" ? now : order.accepted_at,
    completed_at: status === "completed" ? now : order.completed_at,
    customer: status === "completed" ? { ...order.customer, phone: null } : order.customer,
  };
}
