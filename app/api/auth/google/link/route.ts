// This file is used to receive a link request from user in case that 
// user is already sign in the application with the Zalo account and they want to request 
// link with Google as the second authentication method

// Tạo JSON response hoặc redirect của Next.js.
import { NextResponse } from "next/server";
// Supabase client gắn với session/cookie người dùng.
import { createClient } from "@/lib/supabase/server";
// Admin client chỉ dùng server để truy cập dữ liệu được bảo vệ.
import { createAdminClient } from "@/lib/supabase/admin";
// Nghiệp vụ tài khoản và đồng bộ email liên hệ.
import { ZaloAccountService } from "@/services/zalo-account.service";
// Helper tạo cookie ký tên chứa UUID và nonce liên kết.
import { beginGoogleLink } from "@/lib/auth/google-link-flow";

// Chỉ session đang đăng nhập mới được thêm Google; không dùng signInWithOAuth ở nhánh này.
// Endpoint nhận POST từ frontend.
export async function POST(request: Request) {
  // Lấy origin ứng dụng để kiểm tra request và dựng callback.
  const origin = new URL(request.url).origin;
  // Chặn POST khác origin để bảo vệ thao tác sử dụng cookie session.
  if (request.headers.get("origin") !== origin) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  // Bắt đầu nhóm thao tác có thể phát sinh lỗi.
  try {
    // Tạo client đọc session hiện tại và ghi cookie khi nhận session mới.
    const supabaseServerClient = await createClient();
    // Xác minh user hiện tại với Supabase Auth.
    const { data, error } = await supabaseServerClient.auth.getUser();
    // Không có user hợp lệ: trả 401, yêu cầu đăng nhập lại.
    if (error || !data.user) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
    // Chỉ kiểm tra active/chưa có Google và tài khoản Zalo; chưa insert mapping.
    await ZaloAccountService.prepareGoogleLink(createAdminClient(), data.user);
    // Lưu cookie HttpOnly ký tên và lấy nonce đối chiếu callback.
    const nonce = await beginGoogleLink(data.user.id);
    // Gắn Google vào user hiện tại qua Supabase; cần bật Manual Linking.
    const { data: link, error: linkError } = await supabaseServerClient.auth.linkIdentity({
      // Nhà cung cấp được thêm là Google.
      provider: "google",
      // Các tùy chọn điều hướng OAuth.
      options: {
        // Supabase trả về callback này; mode chọn nhánh link, intent đối chiếu cookie.
        redirectTo: `${origin}/api/auth/google/callback?mode=link&intent=${nonce}`,
        // Chỉ lấy URL; frontend nhận JSON rồi tự chuyển trình duyệt.
        skipBrowserRedirect: true,
        // Yêu cầu chọn tài khoản Google, không bắt buộc hiện lại màn hình cấp quyền.
        queryParams: { prompt: "select_account" },
      },
    });
    // Dừng nếu Supabase từ chối hoặc không có URL.
    if (linkError || !link.url) throw linkError ?? new Error("LINK_URL_MISSING");
    // Trả URL cho frontend, không cache dữ liệu của flow.
    return NextResponse.json({ url: link.url }, { headers: { "Cache-Control": "no-store" } });
  // Xử lý lỗi của khối try tương ứng.
  } catch {
    // Thông báo chung 409; catch này cũng nhận lỗi cấu hình hoặc kết nối.
    return NextResponse.json({ error: "Không thể liên kết Google. Kiểm tra Manual Linking đã bật và Google chưa thuộc tài khoản khác." }, { status: 409 });
  }
}
