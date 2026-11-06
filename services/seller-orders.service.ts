import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isOrderUuid, mapSellerOrder } from "@/lib/seller/order-contract";
import type { SellerManagedOrder } from "@/types/seller-orders.types";

export class SellerOrdersError extends Error {
  constructor(public readonly code: "VALIDATION_ERROR" | "UNAUTHORIZED" | "ORDER_FORBIDDEN" | "RESTAURANT_NOT_FOUND" | "ORDER_NOT_FOUND" | "ORDERS_SCHEMA_MISMATCH" | "ORDERS_READ_FAILED") { super(code); }
}
function check(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "42501") throw new SellerOrdersError("ORDER_FORBIDDEN");
  if (["42703", "42P01", "PGRST200", "PGRST201", "PGRST204"].includes(error.code ?? "")) throw new SellerOrdersError("ORDERS_SCHEMA_MISMATCH");
  throw new SellerOrdersError("ORDERS_READ_FAILED");
}
const fields = `id,restaurant_id,order_code,order_status,created_at,payment_method,subtotal,total,delivery_address,customer_notes,
  customer:users!orders_student_id_fkey(name,phone),
  restaurant:restaurants!orders_restaurant_id_fkey!inner(owner_id,owner:users!restaurants_owner_id_fkey!inner(role,status)),
  order_items(id,item_name_snapshot,unit_price_snapshot,total_price,quantity,selected_options,image_url)`;

async function authorizedQuery(client: SupabaseClient, actor: string, restaurantId: unknown) {
  if (!isOrderUuid(restaurantId)) throw new SellerOrdersError("VALIDATION_ERROR");
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== actor) throw new SellerOrdersError("UNAUTHORIZED");
  const profile = await client.from("users").select("role,status,work_for_restaurant_id").eq("id", actor).maybeSingle();
  check(profile.error);
  if (profile.data?.role === "staff" && profile.data.status === "active") {
    if (!profile.data.work_for_restaurant_id || profile.data.work_for_restaurant_id !== restaurantId) {
      throw new SellerOrdersError("ORDER_FORBIDDEN");
    }
    const shop = await client.from("restaurants").select("id").eq("id", restaurantId).maybeSingle();
    check(shop.error);
    if (!shop.data) throw new SellerOrdersError("RESTAURANT_NOT_FOUND");
    return {
      query: client
        .from("orders")
        .select(fields)
        .eq("restaurant_id", restaurantId)
        .eq("restaurant.owner.role", "seller")
        .eq("restaurant.owner.status", "active"),
    };
  }
  if (profile.data?.role !== "seller" || profile.data.status !== "active") throw new SellerOrdersError("ORDER_FORBIDDEN");
  const owned = await client.from("restaurants").select("id").eq("id", restaurantId).eq("owner_id", actor).maybeSingle();
  check(owned.error);
  if (!owned.data) throw new SellerOrdersError("RESTAURANT_NOT_FOUND");
  // get_restaurant_orders đã xác nhận đang đọc cột option_snapshot_price không tồn tại.
  // Chọn SDK read có chủ đích, không fallback khi RPC/RLS lỗi; không admin/ghi DB.
  // Owner + role/status cũng nằm trong SELECT để không chỉ dựa vào precheck.
  return { query: client.from("orders").select(fields).eq("restaurant_id", restaurantId)
    .eq("restaurant.owner_id", actor).eq("restaurant.owner.role", "seller").eq("restaurant.owner.status", "active") };
}

export const SellerOrderServices = {
  async list(client: SupabaseClient, actor: string, restaurantId: unknown): Promise<{ orders: SellerManagedOrder[] }> {
    try {
      const orders = new Map<string, SellerManagedOrder>();
      // Full scoped dataset trước phân trang UI; không lấy số dòng trang làm tổng tab.
      for (let offset = 0; ; ) {
        const { query } = await authorizedQuery(client, actor, restaurantId);
        const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 99);
        check(error);
        if (!Array.isArray(data)) throw new SellerOrdersError("ORDERS_READ_FAILED");
        if (!data.length) break;
        for (const row of data) {
          const order = mapSellerOrder(row, restaurantId as string);
          orders.set(order.id, order);
        }
        offset += data.length;
      }
      return { orders: [...orders.values()] };
    } catch (error) { if (error instanceof SellerOrdersError) throw error; throw new SellerOrdersError("ORDERS_READ_FAILED"); }
  },
  async detail(client: SupabaseClient, actor: string, restaurantId: unknown, orderId: unknown): Promise<{ order: SellerManagedOrder }> {
    if (!isOrderUuid(orderId)) throw new SellerOrdersError("VALIDATION_ERROR");
    try {
      const { query } = await authorizedQuery(client, actor, restaurantId);
      const { data, error } = await query.eq("id", orderId).maybeSingle();
      check(error);
      if (!data) throw new SellerOrdersError("ORDER_NOT_FOUND");
      return { order: mapSellerOrder(data, restaurantId as string) };
    } catch (error) { if (error instanceof SellerOrdersError) throw error; throw new SellerOrdersError("ORDERS_READ_FAILED"); }
  },
};
