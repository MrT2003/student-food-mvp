import type { CartItem } from "@/types/cart.types";
import type { OrderDetail } from "@/types/order.types";
import type { MenuItemDetail, RestaurantPublic } from "@/types/restaurant.types";
import { createOptionHash, getEstimatedUnitPrice, normalizeSelectedOptions } from "@/lib/cart/options";
import { isHistoryOrder } from "@/lib/orders/order-detail";

// Prepare every row before committing; never use snapshot prices or match by name.
export function prepareReorder(order: OrderDetail, context: {
  customerId: string; cartId: string; rows: CartItem[];
  restaurants: RestaurantPublic[]; menu: MenuItemDetail[];
}): CartItem[] {
  if (order.student_id !== context.customerId) throw new Error("Không tìm thấy đơn của bạn.");
  if (!isHistoryOrder(order.order_status)) throw new Error("Chỉ có thể đặt lại đơn đã kết thúc.");
  if (!order.order_items.length) throw new Error("Đơn hàng không có món để đặt lại.");
  const restaurant = context.restaurants.find((r) => r.id === order.restaurant_id);
  if (!restaurant || restaurant.status !== "active" || restaurant.operating_status !== "open") {
    throw new Error("Quán hiện không nhận đơn. Chưa thêm món nào vào giỏ.");
  }
  let rows = [...context.rows];
  const now = new Date().toISOString();
  for (const old of order.order_items) {
    const item = context.menu.find((m) => m.id === old.menu_item_id && m.restaurant_id === order.restaurant_id);
    if (!item?.is_active || !item.is_available) {
      throw new Error(`${old.item_name_snapshot}: món không còn khả dụng. Chưa thêm món nào vào giỏ.`);
    }
    const selected = normalizeSelectedOptions(old.option_snapshot_price.map((o) => ({ option_id: o.option_id })));
    try { getEstimatedUnitPrice(item, selected); } catch {
      throw new Error(`${item.name}: giá hoặc tùy chọn không còn hợp lệ, vui lòng chọn lại ở trang chi tiết món. Chưa thêm món nào vào giỏ.`);
    }
    const hash = createOptionHash(selected);
    const existing = rows.find((r) => r.restaurant_id === restaurant.id && r.menu_item_id === item.id && r.option_hash === hash);
    const quantity = old.quantity + (existing?.quantity ?? 0);
    if (!Number.isInteger(old.quantity) || old.quantity < 1 || !Number.isInteger(quantity) || quantity > 99) {
      throw new Error(`${item.name}: số lượng sau khi gộp phải từ 1 đến 99. Chưa thêm món nào vào giỏ.`);
    }
    const row: CartItem = {
      id: existing?.id ?? crypto.randomUUID(), cart_id: context.cartId,
      restaurant_id: restaurant.id, menu_item_id: item.id, quantity,
      selected_options: selected, option_hash: hash,
      created_at: existing?.created_at ?? now, updated_at: now,
    };
    rows = existing ? rows.map((r) => r.id === existing.id ? row : r) : [...rows, row];
  }
  return rows;
}
