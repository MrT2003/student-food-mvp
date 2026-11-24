import type { SellerManagedOrder } from "@/types/seller-orders.types";

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export const isOrderUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
function amount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0) throw Error("INVALID_ORDER_DATA");
  return number;
}
function imageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
function options(value: unknown): SellerManagedOrder["order_items"][number]["selected_options"] {
  if (!Array.isArray(value) || value.some(row => !record(row) || !text(row.option_name))) return null;
  return value.map(row => ({ group_name: text(row.group_name), option_name: text(row.option_name), additional_price: amount(row.additional_price) }));
}

// Một allowlist dùng cho SDK -> API và kiểm tra response client. Không lấy tên/giá từ menu.
export function mapSellerOrder(value: unknown, restaurantId: string): SellerManagedOrder {
  if (!record(value) || !isOrderUuid(value.id) || value.restaurant_id !== restaurantId ||
    !["pending", "accepted", "completed", "rejected", "cancelled"].includes(String(value.order_status)) ||
    typeof value.created_at !== "string" || !Number.isFinite(Date.parse(value.created_at)) || !Array.isArray(value.order_items) ||
    (value.payment_method !== null && value.payment_method !== "cash" && value.payment_method !== "bank_transfer")) throw Error("INVALID_ORDER_DATA");
  const customer = record(value.customer) ? value.customer : null;
  return {
    id: value.id, restaurant_id: restaurantId, order_code: text(value.order_code),
    order_status: value.order_status as SellerManagedOrder["order_status"], created_at: value.created_at,
    payment_method: value.payment_method, subtotal: amount(value.subtotal), total: amount(value.total),
    delivery_address: text(value.delivery_address), customer_notes: text(value.customer_notes),
    customer: { name: text(customer?.name), phone: value.order_status === "completed" ? null : text(customer?.phone) },
    order_items: value.order_items.map(row => {
      if (!record(row) || !isOrderUuid(row.id) || !Number.isInteger(row.quantity) || Number(row.quantity) < 1) throw Error("INVALID_ORDER_DATA");
      return { id: row.id, item_name_snapshot: text(row.item_name_snapshot), unit_price_snapshot: amount(row.unit_price_snapshot),
        total_price: amount(row.total_price), quantity: Number(row.quantity), image_url: imageUrl(row.image_url), selected_options: options(row.selected_options) };
    }),
  };
}
