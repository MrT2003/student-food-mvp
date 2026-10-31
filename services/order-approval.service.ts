import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRecord } from "@/utilities/system.utility";

export class OrderApprovalError extends Error {
  constructor(public readonly code: "VALIDATION_ERROR" | "ORDER_FORBIDDEN" | "ORDER_NOT_FOUND" | "ORDER_CONFLICT" | "ORDER_APPROVAL_FAILED") { super(code); }
}

export const OrderApprovalServices = {
  // Chỉ dùng session client của request, không admin/pg để vượt RLS khi policy chặn.
  async acceptOrder(client: SupabaseClient, userId: string, orderId: unknown, input: unknown) {
    if (typeof orderId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)
      || !isRecord(input) || Object.keys(input).length !== 0) throw new OrderApprovalError("VALIDATION_ERROR");
    const { data: profile, error: profileError } = await client.from("users")
      .select("role,status,work_for_restaurant_id").eq("id", userId).maybeSingle();
    if (profileError) throw new OrderApprovalError("ORDER_APPROVAL_FAILED");
    if (!profile || profile.status !== "active" || !["seller", "staff"].includes(profile.role)
      || (profile.role === "staff" && !profile.work_for_restaurant_id)) throw new OrderApprovalError("ORDER_FORBIDDEN");

    let query = client.from("orders").select("id,restaurant_id,order_status").eq("id", orderId);
    if (profile.role === "staff") query = query.eq("restaurant_id", profile.work_for_restaurant_id);
    const { data: order, error: orderError } = await query.maybeSingle();
    if (orderError) throw new OrderApprovalError("ORDER_APPROVAL_FAILED");
    if (!order) throw new OrderApprovalError("ORDER_NOT_FOUND");
    if (profile.role === "seller") {
      const { data: restaurant, error } = await client.from("restaurants").select("id")
        .eq("id", order.restaurant_id).eq("owner_id", userId).maybeSingle();
      if (error) throw new OrderApprovalError("ORDER_APPROVAL_FAILED");
      if (!restaurant) throw new OrderApprovalError("ORDER_NOT_FOUND");
    }
    if (order.order_status !== "pending") throw new OrderApprovalError("ORDER_CONFLICT");
    // Flow có căn cứ từ tracking: pending → accepted. Không cho sửa status tùy ý,
    // không sửa giá/thanh toán. Điều kiện pending ngăn hai người duyệt cùng một đơn.
    // RLS phải kiểm tra lại quyền hiện tại ngay tại UPDATE (tránh race đổi role/chủ).
    // Chưa xác minh policy này trên DB thật; application precheck không thay thế RLS.
    const { data: updated, error } = await client.from("orders")
      .update({ order_status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", orderId).eq("restaurant_id", order.restaurant_id).eq("order_status", "pending")
      .select("id,restaurant_id,order_status,accepted_at").maybeSingle();
    if (error) throw new OrderApprovalError(error.code === "42501" ? "ORDER_FORBIDDEN" : "ORDER_APPROVAL_FAILED");
    if (!updated) throw new OrderApprovalError("ORDER_CONFLICT");
    return { order: { id: updated.id, restaurant_id: updated.restaurant_id,
      order_status: updated.order_status, accepted_at: updated.accepted_at } };
  },
};
