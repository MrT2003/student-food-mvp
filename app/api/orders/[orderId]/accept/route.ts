import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";
import { OrderApprovalError, OrderApprovalServices } from "@/services/order-approval.service";

export const runtime = "nodejs";

const errors = {
  VALIDATION_ERROR: [400, "ID đơn hoặc nội dung yêu cầu không hợp lệ."],
  ORDER_FORBIDDEN: [403, "Không có quyền duyệt đơn."], ORDER_NOT_FOUND: [404, "Không tìm thấy đơn thuộc quyền quản lý."],
  ORDER_CONFLICT: [409, "Đơn không còn chờ duyệt hoặc không được phép cập nhật."],
  ORDER_APPROVAL_FAILED: [500, "Không thể duyệt đơn. Vui lòng thử lại."],
} as const;
function failure(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!isSameOrigin(request)) return failure("FORBIDDEN", "Yêu cầu không hợp lệ.", 403);
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return failure("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
    let input: unknown;
    try { input = await request.json(); }
    catch { return failure("INVALID_JSON", "Nội dung JSON không hợp lệ.", 400); }
    const { orderId } = await params;
    return NextResponse.json(await OrderApprovalServices.acceptOrder(client, data.user.id, orderId, input),
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OrderApprovalError) {
      const [status, message] = errors[error.code];
      return failure(error.code, message, status);
    }
    return failure("ORDER_APPROVAL_FAILED", errors.ORDER_APPROVAL_FAILED[1], 500);
  }
}
