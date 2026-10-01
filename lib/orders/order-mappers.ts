import type { SavedPreviewOrder } from "@/store/useOrderPreviewStore";
import type { OrderDetail } from "@/lib/orders/order-detail";
import { getCartItemUnitPrice } from "@/lib/cart/calculations";

const orderDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour12: false,
});

export function formatOrderDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Chưa có thời gian"
    : orderDateFormatter.format(date);
}

export function formatOrderPayment(payment: SavedPreviewOrder["payment"]) {
  return payment === "bank"
    ? "Chuyển khoản ngân hàng"
    : "Thanh toán khi nhận món";
}

export function toOrderDetail(order: SavedPreviewOrder): OrderDetail {
  return {
    id: order.id,
    restaurantName: order.restaurantName,
    restaurantLocation: order.restaurantLocation,
    kind: order.kind,

    // Chưa có API cập nhật trạng thái.
    status: "pending",

    placedAt: formatOrderDate(order.createdAt),
    payment: formatOrderPayment(order.payment),
    note: order.note,

    deliveryLocation: order.deliveryLocation,
    deliveryAddress: order.deliveryAddress,
    deliveryFee: order.deliveryFee,

    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      kind: item.kind,
      quantity: item.quantity,

      unitPrice: getCartItemUnitPrice(item),

      options: item.extras.map((extra) => extra.name),
      note: item.note,
    })),
  };
}
