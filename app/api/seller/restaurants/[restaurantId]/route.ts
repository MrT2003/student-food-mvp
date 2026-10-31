import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";
import { SellerRestaurantUpdateError, SellerServices, SellerValidationError } from "@/services/seller.service";

export const runtime = "nodejs";

const updateErrors = {
  PROFILE_NOT_FOUND: { status: 403, message: "Chưa có hồ sơ tài khoản hợp lệ." },
  ACCOUNT_INACTIVE: { status: 403, message: "Tài khoản hiện không hoạt động." },
  SELLER_REQUIRED: { status: 403, message: "Chỉ seller được cập nhật thông tin cửa hàng." },
  RESTAURANT_NOT_FOUND: { status: 404, message: "Không tìm thấy cửa hàng." },
  DATABASE_CONFIGURATION_MISSING: { status: 503, message: "Chức năng cập nhật cửa hàng chưa được cấu hình." },
  DATABASE_CONFIGURATION_INVALID: { status: 503, message: "Cấu hình cập nhật cửa hàng chưa hợp lệ." },
  UPDATE_FAILED: { status: 500, message: "Không thể cập nhật cửa hàng. Vui lòng thử lại." },
} as const;

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  // Cùng kiểm tra Origin với API đăng ký; không tin UUID hoặc quyền từ body.
  if (!isSameOrigin(request)) {
    return failure("FORBIDDEN", "Yêu cầu không hợp lệ.", 403);
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return failure("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
    const { restaurantId } = await params;
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return failure("INVALID_JSON", "Nội dung JSON không hợp lệ.", 400);
    }
    const result = await SellerServices.updateRestaurant(data.user.id, restaurantId, input);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SellerValidationError) return failure("VALIDATION_ERROR", error.message, 400);
    if (error instanceof SellerRestaurantUpdateError) {
      const detail = updateErrors[error.code];
      return failure(error.code, detail.message, detail.status);
    }
    return failure("UPDATE_FAILED", updateErrors.UPDATE_FAILED.message, 500);
  }
}
