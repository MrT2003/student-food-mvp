import type { OrderDetail } from "@/types/order.types";
import { mockRestaurantNumbers } from "@/lib/mocks/catalog.mock";
import { formatOrderCode } from "@/lib/orders/order-code";

// Local demo only. Production must allocate a unique code atomically on the server.
export function nextMockOrderCode(restaurantId: string, orders: OrderDetail[]): string {
  const number = mockRestaurantNumbers[restaurantId];
  if (!number) throw new Error("Quán demo chưa được cấp số.");
  const prefix = formatOrderCode(number, 1).replace(/0001$/, "");
  const max = orders.filter((order) => order.restaurant_id === restaurantId)
    .reduce((highest, order) => {
      const suffix = order.order_code.startsWith(prefix) ? order.order_code.slice(prefix.length) : "";
      return /^\d{4,}$/.test(suffix) ? Math.max(highest, Number(suffix)) : highest;
    }, 0);
  return formatOrderCode(number, max + 1);
}

export function migrateMockOrderCodes(records: Record<string, OrderDetail>): Record<string, OrderDetail> {
  const migrated = { ...records };
  const legacy = Object.values(records).filter((order) => mockRestaurantNumbers[order.restaurant_id] &&
    (/^DEMO-/.test(order.order_code) || /^SF\d+$/.test(order.order_code)))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
  for (const order of legacy) {
    migrated[order.id] = { ...order, order_code: nextMockOrderCode(order.restaurant_id, Object.values(migrated)) };
  }
  return migrated;
}
