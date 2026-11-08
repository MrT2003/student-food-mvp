import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";
import { SellerRegistrationError, SellerServices, SellerValidationError } from "@/services/seller.service";

export const runtime = "nodejs";

const registrationErrors = {
  PROFILE_NOT_FOUND: { status: 403, message: "Chưa có hồ sơ tài khoản hợp lệ." },
  ACCOUNT_INACTIVE: { status: 403, message: "Tài khoản hiện không hoạt động." },
  ROLE_CONFLICT: { status: 409, message: "Tài khoản không còn đủ điều kiện đăng ký hoặc đã có cửa hàng. Vui lòng tải lại hồ sơ." },
  SLUG_CONFLICT: { status: 409, message: "Chưa thể tạo địa chỉ cửa hàng. Vui lòng thử lại." },
  UNAUTHORIZED: { status: 401, message: "Vui lòng đăng nhập lại." },
  DATABASE_ACCESS_DENIED: { status: 403, message: "Không có quyền thực hiện thao tác này." },
  REGISTRATION_RPC_UNAVAILABLE: { status: 503, message: "Chức năng đăng ký seller chưa truy cập được RPC cần thiết." },
  REGISTRATION_RESULT_UNKNOWN: { status: 503, message: "Chưa xác định được kết quả đăng ký. Kiểm tra lại hồ sơ và cửa hàng trước khi gửi lại." },
  REGISTRATION_FAILED: { status: 500, message: "Không thể xác nhận đăng ký bán hàng. Kiểm tra lại hồ sơ và cửa hàng trước khi gửi lại." },
} as const;

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  // Cookie session: giữ kiểm tra cùng origin như các endpoint auth hiện có.
  if (!isSameOrigin(request)) {
    return failure("FORBIDDEN", "Yêu cầu không hợp lệ.", 403);
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return failure("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return failure("INVALID_JSON", "Nội dung JSON không hợp lệ.", 400);
    }
    // Nghiệp vụ và validation nằm trong service; UUID luôn từ session đã xác minh.
    const result = await SellerServices.register(data.user.id, input, supabase);
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SellerValidationError) return failure("VALIDATION_ERROR", error.message, 400);
    if (error instanceof SellerRegistrationError) {
      const detail = registrationErrors[error.code];
      return failure(error.code, detail.message, detail.status);
    }
    return failure("REGISTRATION_FAILED", registrationErrors.REGISTRATION_FAILED.message, 500);
  }
}
