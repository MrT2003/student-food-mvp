import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";
import { SellerServices, SellerValidationError, SellerRestaurantOpenError } from "@/services/seller.service";

export const runtime = "nodejs";
const errors = {
  UNAUTHORIZED: [401, "Vui lòng đăng nhập lại."],
  PROFILE_NOT_FOUND: [403, "Chưa có hồ sơ hợp lệ."],
  ACCOUNT_INACTIVE: [403, "Tài khoản không hoạt động."],
  SELLER_REQUIRED: [403, "Chỉ seller được mở cửa hàng của mình."],
  RESTAURANT_NOT_FOUND: [404, "Không tìm thấy cửa hàng thuộc tài khoản của bạn."],
  OPERATING_STATUS_CONFLICT: [409, "Thao tác này chỉ mở cửa hàng đang đóng. Hãy tải lại trạng thái."],
  DATABASE_ACCESS_DENIED: [403, "Database từ chối quyền mở cửa hàng."],
  RESTAURANT_OPEN_RPC_UNAVAILABLE: [503, "RPC set_restaurant_operating_status chưa sẵn sàng hoặc không đúng contract."],
  RESTAURANT_OPEN_RESULT_UNKNOWN: [503, "Chưa xác định kết quả mở cửa hàng. Hãy đọc lại trạng thái trước khi thử lại."],
  RESTAURANT_OPEN_FAILED: [500, "Không thể mở cửa hàng. Hãy tải lại trạng thái trước khi thử lại."],
} as const;
function failure(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  if (!isSameOrigin(request)) return failure("FORBIDDEN", "Yêu cầu không hợp lệ.", 403);
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return failure("UNAUTHORIZED", errors.UNAUTHORIZED[1], 401);
    let input: unknown;
    try { input = await request.json(); }
    catch { return failure("INVALID_JSON", "Nội dung JSON không hợp lệ.", 400); }
    const { restaurantId } = await params;
    const result = await SellerServices.openRestaurant(data.user.id, restaurantId, input, client);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SellerValidationError) return failure("VALIDATION_ERROR", error.message, 400);
    if (error instanceof SellerRestaurantOpenError) {
      const [status, message] = errors[error.code];
      return failure(error.code, message, status);
    }
    return failure("RESTAURANT_OPEN_FAILED", errors.RESTAURANT_OPEN_FAILED[1], 500);
  }
}
