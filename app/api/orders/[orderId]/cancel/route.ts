import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOrigin } from "@/lib/http/request-origin";
import { runNotificationWorker } from "@/services/notification-worker.service";

export const runtime = "nodejs";
export const maxDuration = 25;
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Đọc lại kết quả khi POST mất response; tuyệt đối không gửi lại thao tác hủy.
export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return reply({ error: "Mã đơn không hợp lệ." }, 400);
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply({ error: "Vui lòng đăng nhập lại." }, 401);
    const { data: order, error } = await client.from("orders")
      .select("id,order_status,restaurant_id").eq("id", orderId).eq("student_id", auth.user.id).maybeSingle();
    if (error) return reply({ error: "Chưa đọc được trạng thái đơn." }, 503);
    if (!order) return reply({ error: "Không tìm thấy đơn của bạn." }, 404);
    let phone: string | null = null;
    // Chỉ đọc số chủ quán sau khi session/RLS xác nhận người gọi sở hữu đơn.
    // restaurants chưa có số riêng; không trả profile hay số của người khác ngoài chủ quán này.
    if (["accepted", "completed"].includes(order.order_status)) {
      const admin = createAdminClient();
      const { data: restaurant } = await admin.from("restaurants").select("owner_id").eq("id", order.restaurant_id).maybeSingle();
      if (restaurant) {
        const { data: owner } = await admin.from("users").select("phone").eq("id", restaurant.owner_id).maybeSingle();
        phone = owner?.phone ?? null;
      }
    }
    return reply({ orderId: order.id, status: order.order_status, phone });
  } catch { return reply({ error: "Chưa đọc được trạng thái đơn." }, 503); }
}

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  if (!isSameOrigin(request)) return reply({ error: "Yêu cầu không hợp lệ." }, 403);
  const { orderId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return reply({ error: "Mã đơn không hợp lệ." }, 400);
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply({ error: "Vui lòng đăng nhập lại." }, 401);
    // Dùng session client để RPC lấy auth.uid(); không dùng quyền admin để hủy hộ.
    const { data, error } = await client.rpc("cancel_pending_order", { p_order_id: orderId });
    if (error) {
      // Chỉ log mã kỹ thuật, không log session, token hoặc dữ liệu đơn hàng.
      console.error("[orders.cancel] RPC failed", { code: error.code });
      if (["PGRST202", "42883"].includes(error.code)) return reply({ code: "CANCEL_RPC_MISSING", error: "Chức năng hủy đơn chưa được cập nhật trên database." }, 503);
      if (error.code === "42703") return reply({ code: "CANCEL_SCHEMA_MISMATCH", error: "RPC hủy đơn chưa khớp schema database. Cần cập nhật migration sửa lỗi." }, 503);
      if (error.message === "ORDER_INVALID_STATUS") return reply({ error: "Đơn đã được quán xử lý, không thể hủy. Vui lòng xem trạng thái mới." }, 409);
      if (error.message === "ORDER_NOT_FOUND") return reply({ error: "Không tìm thấy đơn thuộc tài khoản của bạn." }, 404);
      if (["NOT_ALLOWED", "UNAUTHORIZED"].includes(error.message)) return reply({ error: "Không có quyền hủy đơn." }, 403);
      return reply({ error: "Chưa thể hủy đơn. Vui lòng tải lại trạng thái trước khi thử lại." }, 503);
    }
    if (data?.success !== true || data.order_id !== orderId || data.order_status !== "cancelled") throw new Error("INVALID_RESULT");
    // Event đã commit; gửi sớm, cron vẫn phục hồi nếu worker lỗi hoặc bận.
    after(async () => {
      try { await runNotificationWorker(); }
      catch { console.error("[notifications] Cancellation wake failed; cron will recover."); }
    });
    return reply(data);
  } catch {
    return reply({ error: "Chưa xác định kết quả hủy. Vui lòng tải lại đơn hàng." }, 503);
  }
}
