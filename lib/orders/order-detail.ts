import type { OrderStatus, OptionSnapshot } from "@/types/order.types";

export { formatMoney as formatOrderMoney } from "@/lib/format";

export type OrderDetailStatus = OrderStatus;

// Đây là view model cho UI, không phải bảng database.
export type OrderDetailItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  kind: "food" | "drink";
  quantity: number;
  unitPrice: number;
  options: string[];
  optionSnapshots: OptionSnapshot[];
};

export type OrderDetail = {
  id: string;
  orderCode: string;
  restaurantId: string;
  restaurantName: string;
  restaurantLocation: string;
  kind: "food" | "drink";
  status: OrderStatus;

  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;

  placedAt: string;
  payment: string;
  note: string;

  deliveryLocation: string;
  deliveryAddress: string;

  subtotal: number;
  total: number;
  deliveryFee: number;

  quantity: number;
  items: OrderDetailItem[];
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Đang chờ xác nhận",
  accepted: "Đã chấp nhận",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  rejected: "Bị từ chối",
};

export function isCurrentOrder(status: OrderStatus): boolean {
  return status === "pending" || status === "accepted";
}

export function isHistoryOrder(status: OrderStatus): boolean {
  return (
    status === "completed" || status === "cancelled" || status === "rejected"
  );
}
