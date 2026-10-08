import { mockMenuItemDetails, mockRestaurants } from "@/lib/mocks/catalog.mock";
import type { SellerOrder } from "@/lib/seller/orders";
import type { OrderStatus } from "@/types/order.types";

export const demoSellerRestaurant = mockRestaurants[0];
// Standalone UI fixtures. Never mixed with customer orders or sent to the database.
export function createSellerOrderFixtures(now: string): SellerOrder[] {
  const menu = mockMenuItemDetails.filter((m) => m.restaurant_id === demoSellerRestaurant.id && !m.option_groups.length);
  const statuses: OrderStatus[] = ["pending", "pending", "pending", "accepted", "completed", "cancelled", "rejected"];
  return statuses.map((status, index) => {
    const id = `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const created = new Date(Date.parse(now) - index * 60_000).toISOString();
    const items = menu.slice(index % 3, index % 3 + (index % 3 + 1)).map((m, n) => ({
      id: `80000000-0000-4000-8000-${String(index * 10 + n + 1).padStart(12, "0")}`,
      order_id: id, menu_item_id: m.id, item_name_snapshot: m.name,
      unit_price_snapshot: m.price, quantity: 1, option_snapshot_price: [], image_url: m.image_url,
    }));
    const total = items.reduce((sum, item) => sum + item.unit_price_snapshot * item.quantity, 0);
    return {
      id, restaurant_id: demoSellerRestaurant.id, student_id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      session_checkout_id: `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      order_code: `SF${String(128 + index).padStart(5, "0")}`, order_status: status,
      payment_method: index % 3 === 2 ? "bank_transfer" : "cash",
      payment_confirmed_at: null, payment_confirmed_by: null,
      subtotal: total, total, delivery_address: ["KTX A, Cổng B, Phòng 302", "KTX C, Tòa C1, Phòng 410", "KTX B, Tòa B2, Phòng 205"][index % 3],
      customer_notes: index === 0 ? "Gọi trước khi giao nhé!" : null,
      created_at: created, accepted_at: status === "accepted" || status === "completed" ? created : null,
      completed_at: status === "completed" ? created : null, order_items: items,
      customer: { name: ["Trần Minh Anh", "Lê Quốc Bảo", "Phạm Thị Mai"][index % 3], phone: status === "completed" ? null : "0900 000 000" },
    };
  });
}
