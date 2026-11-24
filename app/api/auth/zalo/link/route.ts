import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { beginZaloFlow } from "@/lib/auth/zalo-flow";
import { ZaloAccountService } from "@/services/zalo-account.service";

// Frontend gọi GET để hiển thị trạng thái phương thức đăng nhập; không bắt đầu OAuth.
export async function GET() {
  try {
    // Tạo Supabase server client gắn với cookie/session của request hiện tại.
    const supabaseServer = await createClient();
    // Xác minh user với Supabase Auth, không tin UUID do frontend tự cung cấp.
    const { data, error } = await supabaseServer.auth.getUser();
    // Session không hợp lệ hoặc chưa đăng nhập: trả 401 và dừng xử lý.
    if (error || !data.user) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
    
    // RLS cho phép đọc mapping của chính user nên không cần admin; maybeSingle trả null nếu chưa có.
    const { data: linked, error: linkedError } = await supabaseServer.from("user_zalo_identities").select("user_id").eq("user_id", data.user.id).maybeSingle();
    // Lỗi truy vấn phải được báo lỗi, không hiểu nhầm thành chưa liên kết.
    if (linkedError) throw linkedError;
    // AccountSecurity nhận JSON này bằng fetch để hiển thị trạng thái và nút liên kết.
    return NextResponse.json({
      // UUID để frontend đối chiếu response với tài khoản đang hiển thị.
      userId: data.user.id,
      // Google được xác định từ identities do Supabase Auth quản lý.
      google: ZaloAccountService.hasGoogleIdentity(data.user),
      // Zalo có mapping hoặc là tài khoản độc lập với email Zalo; không có mapping chưa chắc chưa có Zalo.
      zalo: Boolean(linked) || /^\d{1,64}@zalo\.app$/.test(data.user.email ?? ""),
    // Không cache response chứa trạng thái hoặc URL xác thực của user.
    }, { headers: { "Cache-Control": "no-store" } });
  // Không tải được trạng thái: frontend nhận 503 và có thể thử lại.
  } catch {
    return NextResponse.json({ error: "Chưa thể kiểm tra phương thức đăng nhập. Vui lòng thử lại sau." }, { status: 503 });
  }
}

// Frontend gọi POST khi user Google bấm liên kết Zalo; mapping chỉ được ghi ở callback sau OAuth.
export async function POST(request: Request) {
  // Chặn POST khác origin nhằm bảo vệ thao tác sử dụng cookie session.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }
  try {
    // Tạo Supabase server client gắn với cookie/session của request hiện tại.
    const supabaseServer = await createClient();
    // Xác minh user với Supabase Auth, không tin UUID do frontend tự cung cấp.
    const { data, error } = await supabaseServer.auth.getUser();
    // Session không hợp lệ hoặc chưa đăng nhập: trả 401 và dừng xử lý.
    if (error || !data.user) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
    // Chỉ cho phép chiều Google → Zalo; chiều ngược lại dùng /api/auth/google/link.
    if (!ZaloAccountService.hasGoogleIdentity(data.user)) {
      return NextResponse.json({ error: "Tính năng này dành cho tài khoản đã liên kết Google." }, { status: 403 });
    }
    // Admin chỉ dùng ở server, sau khi đã xác minh user và phương thức Google.
    const admin = createAdminClient();
    // Đọc public profile của đúng UUID đang đăng nhập.
    const { data: profile, error: profileError } = await admin.from("users")
      .select("status").eq("id", data.user.id).maybeSingle();
    // Profile thiếu, bị khóa hoặc không đọc được: không cho bắt đầu liên kết.
    if (profileError || profile?.status !== "active") {
      return NextResponse.json({ error: "Chưa thể xác minh hồ sơ tài khoản." }, { status: 403 });
    }
    // Kiểm tra mapping trước khi chuyển sang Zalo; lỗi bảng/quyền được phát hiện ngay tại đây.
    const { data: linked, error: linkedError } = await admin.from("user_zalo_identities")
      .select("user_id").eq("user_id", data.user.id).maybeSingle();
    // Lỗi truy vấn phải được báo lỗi, không hiểu nhầm thành chưa liên kết.
    if (linkedError) throw linkedError;
    // UUID này đã có mapping Zalo: trả 409, không khởi tạo liên kết mới.
    if (linked) return NextResponse.json({ error: "Tài khoản đã liên kết Zalo." }, { status: 409 });
    // Tạo cookie ký tên chứa mode=link, UUID, state, PKCE và thời hạn; trả URL để frontend tự redirect, chưa insert mapping.
    return NextResponse.json({ url: await beginZaloFlow(data.user.id) }, {
      // Không cache response chứa trạng thái hoặc URL xác thực của user.
      headers: { "Cache-Control": "no-store" },
    });
  // Lỗi DB/cấu hình OAuth: frontend nhận 503; chưa hoàn tất liên kết.
  } catch {
    return NextResponse.json({ error: "Chưa thể bắt đầu liên kết Zalo. Vui lòng thử lại sau." }, { status: 503 });
  }
}
