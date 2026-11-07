import { after, NextResponse } from "next/server";
import { runNotificationWorker } from "@/services/notification-worker.service";
import { isSameOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";
import { OrderApprovalError, OrderApprovalServices } from "@/services/order-approval.service";

const errors = {
  VALIDATION_ERROR: [400, "ID đơn hoặc nội dung yêu cầu không hợp lệ."],
  UNAUTHORIZED: [401, "Vui lòng đăng nhập lại."],
  ORDER_FORBIDDEN: [403, "Không có quyền xử lý đơn."],
  ORDER_NOT_FOUND: [404, "Không tìm thấy đơn thuộc quyền quản lý."],
  ORDER_CONFLICT: [409, "Đơn không còn chờ xác nhận. Hãy tải lại."],
  ORDER_RPC_UNAVAILABLE: [503, "RPC xử lý đơn chưa sẵn sàng. Cần nhóm DB kiểm tra."],
  ORDER_RESULT_UNKNOWN: [503, "Chưa xác định kết quả xử lý. Hãy đọc lại trạng thái trước khi thử lại."],
  ORDER_APPROVAL_FAILED: [500, "Không thể xử lý đơn. Hãy tải lại trước khi thử lại."],
} as const;
function failure(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function approveOrder(request: Request, params: Promise<{ orderId: string }>, action: "accept" | "reject") {
  if (!isSameOrigin(request)) return failure("FORBIDDEN", "Yêu cầu không hợp lệ.", 403);
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return failure("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
    let input: unknown;
    try { input = await request.json(); }
    catch { return failure("INVALID_JSON", "Nội dung JSON không hợp lệ.", 400); }
    const { orderId } = await params;
    const result = await OrderApprovalServices[action === "accept" ? "acceptOrder" : "rejectOrder"](client, data.user.id, orderId, input);
    // Transaction đã commit event; gửi sớm sau response. Cron phục hồi nếu lượt này lỗi/bận.
    after(async () => {
      try { await runNotificationWorker(); }
      catch { console.error("[notifications] Decision wake failed; cron will retry."); }
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof OrderApprovalError ? error.code : "ORDER_APPROVAL_FAILED";
    const [status, message] = errors[code];
    return failure(code, message, status);
  }
}
