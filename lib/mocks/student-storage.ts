import type { Cart, CartItem } from "@/types/cart.types";
import type { OrderDetail } from "@/types/order.types";
import { createOptionHash } from "@/lib/cart/options";

// Local demo data only. Never use this as authentication or server order data.
export type StudentSnapshot = {
  version: 1;
  customerId: string;
  cart: Cart;
  cart_items: CartItem[];
  orderRecords: Record<string, OrderDetail>;
  location: string;
  address: string;
  preferences: Partial<Record<string, { payment: "bank" | "cash"; note: string }>>;
  lastCheckout: { sessionId: string; location: string; address: string } | null;
};

export const studentStorageKey = (customerId: string) =>
  `student-food:mock:student:${customerId}:v1`;

const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string";
const nullableText = (v: unknown) => v === null || text(v);
const money = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
const nullableDate = (v: unknown) => v === null || date(v);
const quantity = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 99;
const id = (v: unknown): v is string =>
  text(v) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function validOrder(v: unknown, customerId: string): boolean {
  if (!object(v) || !id(v.id) || v.student_id !== customerId ||
      !id(v.restaurant_id) || !id(v.session_checkout_id) || !text(v.order_code) ||
      !["pending", "accepted", "completed", "cancelled", "rejected"].includes(String(v.order_status)) ||
      !["cash", "bank_transfer"].includes(String(v.payment_method)) ||
      !nullableText(v.customer_notes) || !nullableText(v.delivery_address) ||
      !nullableText(v.payment_confirmed_by) || !nullableDate(v.payment_confirmed_at) ||
      !date(v.created_at) || !nullableDate(v.accepted_at) || !nullableDate(v.completed_at) ||
      !money(v.subtotal) || !money(v.total) ||
      !Array.isArray(v.order_items) || !v.order_items.length) return false;

  const ids = new Set<string>();
  let subtotal = 0;
  for (const item of v.order_items) {
    if (!object(item) || !id(item.id) || ids.has(item.id) || item.order_id !== v.id ||
        !(item.menu_item_id === null || id(item.menu_item_id)) ||
        !text(item.item_name_snapshot) || !nullableText(item.image_url) ||
        !quantity(item.quantity) || !money(item.unit_price_snapshot) ||
        !Array.isArray(item.option_snapshot_price)) return false;
    ids.add(item.id);
    let extras = 0;
    for (const option of item.option_snapshot_price) {
      if (!object(option) || !id(option.option_id) || !text(option.group_name) ||
          !text(option.option_name) || !money(option.additional_price)) return false;
      extras += option.additional_price;
    }
    if (extras > item.unit_price_snapshot) return false;
    subtotal += item.unit_price_snapshot * item.quantity;
  }
  return subtotal === v.subtotal;
}

// Validate browser data before it reaches components; retain the original key on error.
export function parseStudentSnapshot(raw: string, customerId: string): StudentSnapshot {
  const v: unknown = JSON.parse(raw);
  const fail = () => { throw new Error("Dữ liệu demo đã lưu không hợp lệ hoặc khác phiên bản."); };
  if (!object(v) || v.version !== 1 || v.customerId !== customerId ||
      !object(v.cart) || !id(v.cart.id) || v.cart.student_id !== customerId ||
      !date(v.cart.created_at) || !date(v.cart.updated_at) ||
      !Array.isArray(v.cart_items) || !object(v.orderRecords) ||
      !text(v.location) || !text(v.address) || !object(v.preferences)) return fail();

  const ids = new Set<string>();
  const combinations = new Set<string>();
  const restaurants = new Set<string>();
  for (const row of v.cart_items) {
    if (!object(row) || !id(row.id) || ids.has(row.id) || row.cart_id !== v.cart.id ||
        !id(row.restaurant_id) || !id(row.menu_item_id) || !quantity(row.quantity) ||
        !date(row.created_at) || !date(row.updated_at) || !Array.isArray(row.selected_options) ||
        !row.selected_options.every((o: unknown) => object(o) && id(o.option_id))) return fail();
    const selected = row.selected_options as { option_id: string }[];
    if (new Set(selected.map((o) => o.option_id)).size !== selected.length ||
        row.option_hash !== createOptionHash(selected)) return fail();
    const combination = `${row.restaurant_id}:${row.menu_item_id}:${row.option_hash}`;
    if (combinations.has(combination)) return fail();
    combinations.add(combination);
    ids.add(row.id);
    restaurants.add(row.restaurant_id);
  }
  for (const [key, order] of Object.entries(v.orderRecords)) {
    if (!object(order) || key !== order.id || !validOrder(order, customerId)) return fail();
  }
  for (const [key, pref] of Object.entries(v.preferences)) {
    if (!restaurants.has(key) || !object(pref) ||
        !["bank", "cash"].includes(String(pref.payment)) || !text(pref.note)) return fail();
  }
  if (v.lastCheckout !== null) {
    const last = v.lastCheckout;
    if (!object(last) || !id(last.sessionId) || !text(last.location) || !text(last.address) ||
        !Object.values(v.orderRecords).some((o) => object(o) && o.session_checkout_id === last.sessionId)) return fail();
  }
  return v as unknown as StudentSnapshot;
}
