// Tạo JSON response hoặc redirect của Next.js.
import { NextResponse } from "next/server";
// Supabase client gắn với session/cookie người dùng.
import { createClient } from "@/lib/supabase/server";
// Admin client chỉ dùng server để truy cập dữ liệu được bảo vệ.
import { createAdminClient } from "@/lib/supabase/admin";
// Nghiệp vụ tài khoản và đồng bộ email liên hệ.
import { ZaloAccountService } from "@/services/zalo-account.service";

// Retry cập nhật email liên hệ sau khi link thành công nhưng DB tạm thời lỗi.
// Endpoint nhận POST từ frontend.
export async function POST(request: Request) {
  // Chặn POST khác origin để bảo vệ thao tác sử dụng cookie session.
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  // Bắt đầu nhóm thao tác có thể phát sinh lỗi.
  try {
    // Tạo client đọc session hiện tại và ghi cookie khi nhận session mới.
    const supabaseServerClient = await createClient();
    // Xác minh user hiện tại với Supabase Auth.
    const { data, error } = await supabaseServerClient.auth.getUser();
    // Không có user hợp lệ: trả 401, yêu cầu đăng nhập lại.
    if (error || !data.user) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
    // Retry toàn bộ mapping + contact_email cho user đã xác minh; không nhận Zalo ID/email từ browser.
    await ZaloAccountService.completeGoogleLink(createAdminClient(), data.user.id);
    // Báo đồng bộ thành công; không tạo user hay liên kết Google lần nữa.
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  // Xử lý lỗi của khối try tương ứng.
  } catch {
    // Trả lỗi để UI cho thử lại; không xóa liên kết Google đã có.
    return NextResponse.json({ error: "Chưa thể đồng bộ email Google đã xác minh." }, { status: 503 });
  }
}
