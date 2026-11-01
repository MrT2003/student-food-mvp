import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";
import { SellerBankError, SellerServices, SellerValidationError } from "@/services/seller.service";

const bankErrors = {
  PROFILE_NOT_FOUND: { status: 403, message: "Chưa có hồ sơ tài khoản hợp lệ." },
  ACCOUNT_INACTIVE: { status: 403, message: "Tài khoản hiện không hoạt động." },
  SELLER_REQUIRED: { status: 403, message: "Chỉ seller được quản lý tài khoản ngân hàng của cửa hàng." },
  RESTAURANT_NOT_FOUND: { status: 404, message: "Không tìm thấy cửa hàng." },
  BANK_NOT_FOUND: { status: 404, message: "Không tìm thấy tài khoản ngân hàng." },
  BANK_ACCOUNT_CONFLICT: { status: 409, message: "Số tài khoản đã tồn tại trong cửa hàng này." },
  BANK_WRITE_FAILED: { status: 500, message: "Không thể lưu tài khoản ngân hàng. Vui lòng thử lại." },
  DATABASE_CONFIGURATION_MISSING: { status: 503, message: "Chức năng ngân hàng chưa được cấu hình." },
  DATABASE_CONFIGURATION_INVALID: { status: 503, message: "Cấu hình chức năng ngân hàng chưa hợp lệ." },
} as const;

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

// Dùng chung Auth/Origin/error mapping cho hai endpoint; nghiệp vụ vẫn trong SellerServices.
export async function handleBankRequest(
  request: Request,
  params: Promise<{ restaurantId: string; bankId?: string }>,
  mode: "create" | "update",
) {
  if (!isSameOrigin(request)) {
    return failure("FORBIDDEN", "Yêu cầu không hợp lệ.", 403);
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return failure("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
    const { restaurantId, bankId } = await params;
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return failure("INVALID_JSON", "Nội dung JSON không hợp lệ.", 400);
    }
    const result = mode === "create"
      ? await SellerServices.createRestaurantBank(data.user.id, restaurantId, input)
      : await SellerServices.updateRestaurantBank(data.user.id, restaurantId, bankId, input);
    return NextResponse.json(result, { status: mode === "create" ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SellerValidationError) return failure("VALIDATION_ERROR", error.message, 400);
    if (error instanceof SellerBankError) {
      const detail = bankErrors[error.code];
      return failure(error.code, detail.message, detail.status);
    }
    return failure("BANK_WRITE_FAILED", bankErrors.BANK_WRITE_FAILED.message, 500);
  }
}
