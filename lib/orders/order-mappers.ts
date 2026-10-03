import type {
  OrderDetail as OrderRecord,
  PaymentMethod,
} from "@/types/order.types";

import type { OrderDetail, OrderDetailItem } from "@/lib/orders/order-detail";

import { mockRestaurants, mockMenuItems } from "@/lib/mocks/catalog.mock";

const orderDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour12: false,
});

export function formatOrderDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Chưa có thời gian"
    : orderDateFormatter.format(date);
}

export function formatOrderPayment(
  payment: PaymentMethod | "bank" | null,
): string {
  if (payment === "bank_transfer" || payment === "bank") {
    return "Chuyển khoản ngân hàng";
  }

  if (payment === "cash") {
    return "Thanh toán khi nhận món";
  }

  return "Chưa có phương thức thanh toán";
}

export function toOrderDetail(order: OrderRecord): OrderDetail {
  // Thông tin quán hiện tại chỉ để bổ sung phần hiển thị.
  // Thiếu quán không được làm mất đơn.
  const restaurant = mockRestaurants.find(
    (entry) => entry.id === order.restaurant_id,
  );

  const items: OrderDetailItem[] = order.order_items.map((item) => {
    const menuItem = mockMenuItems.find(
      (entry) => entry.id === item.menu_item_id,
    );

    return {
      id: item.id,
      name: item.item_name_snapshot,
      imageUrl: item.image_url,
      quantity: item.quantity,

      // Đã bao gồm phụ thu tùy chọn.
      unitPrice: item.unit_price_snapshot,

      options: item.option_snapshot_price.map(
        (option) => `${option.group_name}: ${option.option_name}`,
      ),

      // Không có ghi chú riêng cho món.
      note: "",

      // Menu chỉ dùng chọn icon, không dùng lấy lại tên/giá.
      kind: menuItem?.category === "Nước uống" ? "drink" : "food",
    };
  });

  return {
    id: order.id,
    orderCode: order.order_code,
    restaurantId: order.restaurant_id,
    restaurantName: restaurant?.name ?? "Cửa hàng không còn khả dụng",
    restaurantLocation: restaurant?.location ?? "",
    kind:
      items.length > 0 && items.every((item) => item.kind === "drink")
        ? "drink"
        : "food",
    status: order.order_status,

    createdAt: order.created_at,
    acceptedAt: order.accepted_at,
    completedAt: order.completed_at,

    placedAt: formatOrderDate(order.created_at),
    payment: formatOrderPayment(order.payment_method),
    note: order.customer_notes ?? "",

    // Database lưu địa chỉ đầy đủ trong một trường.
    // Không tách chuỗi bằng dấu phẩy để đoán khu vực.
    deliveryLocation: "",
    deliveryAddress: order.delivery_address ?? "",

    subtotal: order.subtotal,
    total: order.total,

    // Phép suy ra này chỉ đúng với checkout mock hiện tại:
    // total = subtotal + phí giao hàng, chưa có giảm giá.
    deliveryFee: order.total - order.subtotal,

    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
  };
}
