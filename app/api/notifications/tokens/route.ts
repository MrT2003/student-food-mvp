import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Biểu diễn thời điểm hiện tại theo giờ Việt Nam (UTC+7, không có DST).
// Cộng 7 giờ để tạo phần giờ địa phương rồi gắn +07:00, KHÔNG giữ hậu tố Z.
// PostgreSQL timestamptz vẫn chuẩn hóa về UTC; thời điểm thực không bị dịch thêm 7 giờ.
function vietnamTimestamp(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().replace("Z", "+07:00");
}

function respond(body: object, status = 200) {
  // Không cache kết quả phụ thuộc tài khoản, kể cả response lỗi.
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// Đọc có giới hạn ngay từ stream, tránh giữ body lớn trong bộ nhớ server.
async function readToken(request: Request): Promise<string | null> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    // Chỉ nhận token; không cho frontend tự chỉ định user_id hoặc timestamps.
    if (Object.keys(body).some((key) => key !== "token")) return null;
    const token = (body as { token?: unknown }).token;
    // FCM token là opaque string: không giả định độ dài cố định hay giải mã thành JWT.
    if (typeof token !== "string" || !token.length || token.length > 4096 || /\s|[\x00-\x1f\x7f]/.test(token)) return null;
    return token;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

async function handle(request: Request, action: "register" | "remove") {
  // API dùng cookie: chặn request khác origin trước khi thực hiện thao tác đặc quyền.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return respond({ error: "Nguồn yêu cầu không hợp lệ." }, 403);
  }
  try {
    const sessionClient = await createClient();
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError || !user) return respond({ error: "Vui lòng đăng nhập lại." }, 401);
    // Header chỉ dùng phát hiện tab cũ; quyền truy cập vẫn lấy từ session đã xác thực.
    if (request.headers.get("x-expected-user-id") !== user.id) {
      return respond({ error: "Tài khoản đã thay đổi. Vui lòng tải lại trang." }, 409);
    }
    const token = await readToken(request);
    if (!token) return respond({ error: "Body phải là JSON chứa token hợp lệ." }, 400);

    // Bảng token không cho browser truy cập trực tiếp; chỉ dùng admin sau khi xác thực.
    const admin = createAdminClient();
    if (action === "register") {
      const { data: profile, error } = await admin.from("users").select("status").eq("id", user.id).maybeSingle();
      if (error) throw error;
      if (!profile || profile.status !== "active") return respond({ error: "Tài khoản không được phép đăng ký thông báo." }, 403);

      // Token đã có chủ thì không chuyển chủ: request cũ đến trễ không giành lại token.
      // Token không phải bằng chứng xác thực user; quyền user đến từ getUser() phía trên.
      // Không log/chia sẻ token. Đây không phải xác minh token thực sự tồn tại trên FCM.
      const { error: saveError } = await admin.from("user_push_tokens").upsert({
        user_id: user.id,
        token,
        updated_at: vietnamTimestamp(),
      }, { onConflict: "token", ignoreDuplicates: true });
      if (saveError) throw saveError;
      const { data: registered, error: refreshError } = await admin.from("user_push_tokens")
        .update({ updated_at: vietnamTimestamp() }).eq("token", token).eq("user_id", user.id)
        .select("id").maybeSingle();
      if (refreshError) throw refreshError;
      if (!registered) return respond({ error: "Token thuộc tài khoản khác. Vui lòng tắt rồi bật lại thông báo." }, 409);
    } else {
      // Gỡ trước khi signOut. Lọc cả user_id để request logout cũ không xóa token của user mới.
      // Cho phép gỡ cả khi profile không còn active; xóa lại nhiều lần vẫn thành công.
      const { error } = await admin.from("user_push_tokens").delete().eq("token", token).eq("user_id", user.id);
      if (error) throw error;
    }
    return respond({ success: true });
  } catch {
    // Không trả lỗi DB thô: lỗi unique/SQL có thể chứa giá trị token.
    return respond({ error: "Chưa thể cập nhật đăng ký thông báo. Vui lòng thử lại." }, 503);
  }
}

export function POST(request: Request) { return handle(request, "register"); }
export function DELETE(request: Request) { return handle(request, "remove"); }
