import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRecord } from "@/utilities/system.utility";

export class OrderApprovalError extends Error {
  constructor(public readonly code: "VALIDATION_ERROR" | "UNAUTHORIZED" | "ORDER_FORBIDDEN" | "ORDER_NOT_FOUND" | "ORDER_CONFLICT" | "ORDER_RPC_UNAVAILABLE" | "ORDER_RESULT_UNKNOWN" | "ORDER_APPROVAL_FAILED") { super(code); }
}
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function check(error: { code?: string } | null) {
  if (error) throw new OrderApprovalError(error.code === "42501" ? "ORDER_FORBIDDEN" : "ORDER_APPROVAL_FAILED");
}
async function decide(client: SupabaseClient, userId: string, orderId: unknown, input: unknown, action: "accept" | "reject") {
  if (!uuid(orderId) || !isRecord(input) || Object.keys(input).length !== 0) throw new OrderApprovalError("VALIDATION_ERROR");
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== userId) throw new OrderApprovalError("UNAUTHORIZED");
  const { data: profile, error: profileError } = await client.from("users")
    .select("role,status,work_for_restaurant_id").eq("id", userId).maybeSingle();
  check(profileError);
  // Owner và staff active đúng quán đều được duyệt/từ chối; RPC vẫn kiểm quyền trong transaction.
  if (!profile || profile.status !== "active" || !["seller", "staff"].includes(profile.role)
    || (profile.role === "staff" && !profile.work_for_restaurant_id)) throw new OrderApprovalError("ORDER_FORBIDDEN");
  let query = client.from("orders").select("id,restaurant_id,order_status").eq("id", orderId);
  if (profile.role === "staff") query = query.eq("restaurant_id", profile.work_for_restaurant_id);
  const { data: order, error: orderError } = await query.maybeSingle();
  check(orderError);
  if (!order) throw new OrderApprovalError("ORDER_NOT_FOUND");
  if (profile.role === "seller") {
    const { data: restaurant, error } = await client.from("restaurants").select("id")
      .eq("id", order.restaurant_id).eq("owner_id", userId).maybeSingle();
    check(error);
    if (!restaurant) throw new OrderApprovalError("ORDER_NOT_FOUND");
  }
  if (order.order_status !== "pending") throw new OrderApprovalError("ORDER_CONFLICT");
  let result;
  try { result = await client.rpc(action === "accept" ? "accept_order" : "reject_order", { p_order_id: orderId }); }
  catch { throw new OrderApprovalError("ORDER_RESULT_UNKNOWN"); }
  if (result.error) {
    const { code, message } = result.error;
    if (message === "ORDER_NOT_FOUND") throw new OrderApprovalError("ORDER_NOT_FOUND");
    if (message === "NOT_ALLOWED" || code === "42501") throw new OrderApprovalError("ORDER_FORBIDDEN");
    if (message === "ORDER_INVALID_STATUS") throw new OrderApprovalError("ORDER_CONFLICT");
    if (code === "PGRST202" || code === "42883") throw new OrderApprovalError("ORDER_RPC_UNAVAILABLE");
    if (!code) throw new OrderApprovalError("ORDER_RESULT_UNKNOWN");
    throw new OrderApprovalError("ORDER_APPROVAL_FAILED");
  }
  const status = action === "accept" ? "accepted" : "rejected";
  if (!isRecord(result.data) || result.data.success !== true || result.data.order_id !== orderId || result.data.order_status !== status)
    throw new OrderApprovalError("ORDER_RESULT_UNKNOWN");
  // RPC khóa cùng hàng order FOR UPDATE, kiểm tra lại pending và owner/staff trong
  // transaction; không giữ đường UPDATE cũ, không ghi bù hoặc retry mutation.
  // accepted_at phải lấy từ DB, không tự dựng timestamp từ đồng hồ application.
  try {
    const { data, error } = await client.from("orders").select("id,restaurant_id,order_status,accepted_at")
      .eq("id", orderId).eq("restaurant_id", order.restaurant_id).maybeSingle();
    if (error || !data || data.id !== orderId || data.order_status !== status ||
      (action === "accept" && (typeof data.accepted_at !== "string" || !Number.isFinite(Date.parse(data.accepted_at)))))
      throw new OrderApprovalError("ORDER_RESULT_UNKNOWN");
    return { order: { id: data.id, restaurant_id: data.restaurant_id, order_status: status, accepted_at: data.accepted_at ?? null } };
  } catch { throw new OrderApprovalError("ORDER_RESULT_UNKNOWN"); }
}

export const OrderApprovalServices = {
  async acceptOrder(client: SupabaseClient, userId: string, orderId: unknown, input: unknown) {
    return decide(client, userId, orderId, input, "accept");
  },
  async rejectOrder(client: SupabaseClient, userId: string, orderId: unknown, input: unknown) {
    return decide(client, userId, orderId, input, "reject");
  },
};
