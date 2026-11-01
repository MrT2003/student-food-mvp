import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FirebaseAdminService } from "@/services/firebase-admin.service";

export const runtime = "nodejs";

// API chẩn đoán chỉ chạy khi next dev. Không mở endpoint gửi thử trên production.
// Map dùng chung qua hot reload, giới hạn 1 lần/user/30 giây trong process dev hiện tại.
// Đây không phải rate limiter phân tán: restart server sẽ reset; production cần kho lưu chung.
const state = globalThis as typeof globalThis & { pushTestCooldown?: Map<string, number> };
const cooldown = state.pushTestCooldown ??= new Map<string, number>();
const COOLDOWN_MS = 30_000;

function respond(body: object, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...extraHeaders } });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return respond({ code: "NOT_FOUND" }, 404);
  // Cookie tự gửi từ browser: kiểm tra origin để trang khác không kích hoạt push thử.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return respond({ code: "INVALID_ORIGIN", message: "Nguồn yêu cầu không hợp lệ." }, 403);
  }
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return respond({ code: "UNAUTHORIZED", message: "Vui lòng đăng nhập trước khi gửi thử." }, 401);

    // Không đọc body: userId, nội dung và notificationId đều do server quyết định.
    // Caller không thể gửi cho user khác bằng cách truyền thêm userId trong JSON/query.
    const now = Date.now();
    for (const [id, until] of cooldown) if (until <= now) cooldown.delete(id);
    const remaining = (cooldown.get(user.id) ?? 0) - now;
    if (remaining > 0) {
      const retryAfterSeconds = Math.ceil(remaining / 1000);
      return respond({ code: "RATE_LIMITED", message: "Vui lòng chờ trước khi gửi thử tiếp.", retryAfterSeconds },
        429, { "Retry-After": String(retryAfterSeconds) });
    }
    // Đặt cooldown trước await gửi FCM để hai request đồng thời không cùng vượt giới hạn.
    cooldown.set(user.id, now + COOLDOWN_MS);
    const notificationId = randomUUID();
    const result = await FirebaseAdminService.sendToUser({
      userId: user.id,
      notificationId,
      title: "Thông báo thử StudentFood",
      body: "Bạn đã nhận được thông báo thử từ server StudentFood.",
      // Không dùng đơn giả: worker hiện tại sẽ mở /orders khi không có orderId.
    });

    // Chỉ trả bộ đếm/mã lỗi, không trả token hay registration ID cho browser.
    const summary = {
      notificationId, attempted: result.attempted, accepted: result.accepted, failed: result.failed,
      removedTokens: result.removedTokens,
      errorCodes: [...new Set(result.failures.map((failure) => failure.code))],
      lookupFailed: result.lookupFailed, cleanupFailed: result.cleanupFailedIds.length > 0,
    };
    if (result.lookupFailed && result.accepted === 0) {
      return respond({ ...summary, code: "TOKEN_LOOKUP_FAILED", message: "Không thể đọc đầy đủ danh sách token." }, 503);
    }
    if (result.attempted === 0) {
      return respond({ ...summary, code: "NO_TOKENS", message: "Tài khoản chưa có token. Hãy bật thông báo rồi thử lại." }, 409);
    }
    if (result.accepted === 0) {
      return respond({ ...summary, code: "SEND_FAILED", message: "FCM chưa chấp nhận thông báo nào. Xem errorCodes để kiểm tra." }, 502);
    }
    const partial = result.failed > 0 || result.lookupFailed;
    return respond({ ...summary, code: partial ? "PARTIALLY_ACCEPTED" : "FCM_ACCEPTED",
      message: partial ? "FCM đã chấp nhận gửi tới một phần thiết bị. Không tự gửi lại toàn bộ."
        : "FCM đã tiếp nhận yêu cầu gửi; chưa xác nhận thiết bị đã hiển thị thông báo." });
  } catch (error) {
    // Chỉ công khai các mã cấu hình đã biết, không trả stack/message SDK có thể chứa secrets.
    const code = error instanceof Error ? error.message : "";
    const knownCodes = new Set(["FIREBASE_ADMIN_CONFIGURATION_MISSING", "FIREBASE_ADMIN_PROJECT_MISMATCH",
      "FIREBASE_ADMIN_CREDENTIAL_INVALID", "PUSH_USER_INACTIVE_OR_MISSING", "PUSH_USER_LOOKUP_FAILED"]);
    return respond({ code: knownCodes.has(code) ? code : "PUSH_TEST_FAILED",
      message: "Chưa thể gửi thông báo thử. Kiểm tra cấu hình server và trạng thái tài khoản." },
      code === "PUSH_USER_INACTIVE_OR_MISSING" ? 403 : 503);
  }
}
