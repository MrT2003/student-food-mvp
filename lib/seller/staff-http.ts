import "server-only";
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";
import { SellerStaffError, SellerValidationError } from "@/services/seller.service";

const errors = {
  PROFILE_NOT_FOUND: [403, "Chưa có hồ sơ hợp lệ."], ACCOUNT_INACTIVE: [403, "Tài khoản hiện không hoạt động."],
  SELLER_REQUIRED: [403, "Chỉ seller được tạo QR tuyển nhân viên."],
  RESTAURANT_NOT_FOUND: [404, "Không tìm thấy cửa hàng thuộc người phát hành."],
  ISSUER_NOT_ALLOWED: [403, "Lời mời không còn đáp ứng điều kiện tuyển nhân viên."],
  STAFF_ROLE_CONFLICT: [409, "Tài khoản không còn là student đủ điều kiện tham gia."],
  STAFF_MEMBERSHIP_CONFLICT: [409, "Bạn đã thuộc một cửa hàng. Chưa hỗ trợ chuyển quán."],
  INVALID_STAFF_TOKEN: [400, "Mã tuyển nhân viên không hợp lệ."], STAFF_TOKEN_EXPIRED: [410, "Mã tuyển nhân viên đã hết hạn."],
  STAFF_TOKEN_CONFIGURATION_MISSING: [503, "Chức năng QR tuyển nhân viên chưa được cấu hình."],
  DATABASE_CONFIGURATION_MISSING: [503, "Chức năng tuyển nhân viên chưa được cấu hình database."],
  DATABASE_CONFIGURATION_INVALID: [503, "Cấu hình database chưa hợp lệ."],
  STAFF_OPERATION_FAILED: [500, "Không thể thực hiện thao tác tuyển nhân viên. Vui lòng thử lại."],
} as const;

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleStaffRequest(request: Request, action: (userId: string, input: unknown) => Promise<unknown>, status = 200) {
  if (!isSameOrigin(request)) return failure("FORBIDDEN", "Yêu cầu không hợp lệ.", 403);
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return failure("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
    let input: unknown;
    try { input = await request.json(); }
    catch { return failure("INVALID_JSON", "Nội dung JSON không hợp lệ.", 400); }
    return NextResponse.json(await action(data.user.id, input), { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SellerValidationError) return failure("VALIDATION_ERROR", error.message, 400);
    if (error instanceof SellerStaffError) {
      const [status, message] = errors[error.code];
      return failure(error.code, message, status);
    }
    return failure("STAFF_OPERATION_FAILED", errors.STAFF_OPERATION_FAILED[1], 500);
  }
}
