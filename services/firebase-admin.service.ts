import "server-only";

import { createPrivateKey } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createAdminClient } from "@/lib/supabase/admin";

const APP_NAME = "student-food-server-push";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export type UserPushMessage = {
  userId: string;
  title: string;
  body: string;
  orderId?: string;
  // Caller giữ cùng ID khi gửi lại cùng sự kiện; worker dùng ID làm notification tag.
  notificationId: string;
};

export type PushSendResult = {
  attempted: number;
  accepted: number;
  failed: number;
  removedTokens: number;
  // Chỉ trả ID dòng DB + mã lỗi, không trả token/credential hoặc lỗi SDK thô.
  failures: { registrationId: string; code: string }[];
  cleanupFailedIds: string[];
  lookupFailed: boolean;
};

// Khởi tạo lười: import file không đọc credential; tái sử dụng app qua các lần hot reload.
// Chỉ gọi từ Node.js server (route dùng runtime="nodejs"), không dùng Edge/browser.
function messagingClient() {
  const existing = getApps().find((app) => app.name === APP_NAME);
  // Get the messaging service for the existing app
  if (existing) return getMessaging(existing);

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!projectId || !clientEmail || !privateKey) throw new Error("FIREBASE_ADMIN_CONFIGURATION_MISSING");
  if (projectId !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()) {
    throw new Error("FIREBASE_ADMIN_PROJECT_MISMATCH");
  }
  // Không log key, kể cả khi PEM sai. Private key phải là RSA service-account key.
  try {
    if (createPrivateKey(privateKey).asymmetricKeyType !== "rsa") throw new Error();
    return getMessaging(initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, APP_NAME));
  } catch {
    throw new Error("FIREBASE_ADMIN_CREDENTIAL_INVALID");
  }
}

function safeErrorCode(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  return typeof code === "string" && /^(messaging|app)\/[a-z0-9-]+$/.test(code)
    ? code : "messaging/unknown-error";
}

/** Gửi một sự kiện tới các thiết bị của user. Caller phải xác thực/phân quyền và lấy userId từ nghiệp vụ server. */
async function sendToUser(input: UserPushMessage): Promise<PushSendResult> {
  if (!UUID.test(input.userId) || (input.orderId !== undefined && !UUID.test(input.orderId))) {
    throw new Error("PUSH_INVALID_ID");
  }
  if (!input.title?.trim() || input.title.length > 120 || !input.body?.trim() || input.body.length > 500
      || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.notificationId)) throw new Error("PUSH_INVALID_MESSAGE");

  // Data-only khớp worker hiện tại: worker tự hiển thị đúng một notification và xử lý click orderId.
  const data = { title: input.title, body: input.body, notificationId: input.notificationId,
    recipientUserId: input.userId, // Frontend kiểm tra owner trước khi hiển thị message đến trễ.
    ...(input.orderId ? { orderId: input.orderId } : {}) };
  if (Buffer.byteLength(JSON.stringify(data), "utf8") > 3500) throw new Error("PUSH_MESSAGE_TOO_LARGE");
  // Create supabase admin client
  const admin = createAdminClient();
  const { data: user, error: userError } = await admin.from("users").select("status").eq("id", input.userId).maybeSingle();
  if (userError) throw new Error("PUSH_USER_LOOKUP_FAILED");
  if (!user || user.status !== "active") throw new Error("PUSH_USER_INACTIVE_OR_MISSING");

  const result: PushSendResult = { attempted: 0, accepted: 0, failed: 0, removedTokens: 0, failures: [], cleanupFailedIds: [], lookupFailed: false };
  let cursor: string | undefined;
  for (;;) {
    // Keyset pagination tránh giới hạn mặc định của Supabase; FCM nhận tối đa 500 tokens/batch.
    let query = admin.from("user_push_tokens").select("id, token, updated_at")
      .eq("user_id", input.userId).order("id").limit(500);
    if (cursor) query = query.gt("id", cursor);
    const { data: rows, error } = await query;
    // Không throw sau khi đã gửi một phần: caller cần biết kết quả để tránh gửi lại các token thành công.
    if (error) { result.lookupFailed = true; break; }
    if (!rows?.length) break;
    const messaging = messagingClient();
    result.attempted += rows.length;
    let responses;
    try {
      const batch = await messaging.sendEachForMulticast({ tokens: rows.map((row) => row.token), data,
        webpush: { headers: { TTL: "3600", Urgency: "high" } } });
      responses = batch.responses;
    } catch (error) {
      // Lỗi cả batch (credential/network/payload): giữ token, không suy diễn là token chết.
      result.failed += rows.length;
      for (const row of rows) result.failures.push({ registrationId: row.id, code: safeErrorCode(error) });
    }
    if (responses) {
      for (let index = 0; index < responses.length; index++) {
        const response = responses[index];
        const row = rows[index]; // SDK trả kết quả cùng thứ tự với tokens đầu vào.
        if (response.success) { result.accepted++; continue; }
        const code = safeErrorCode(response.error);
        result.failed++;
        result.failures.push({ registrationId: row.id, code });
        if (!DEAD_TOKEN_CODES.has(code)) continue;
        // Không xóa vì invalid-argument: có thể payload sai, không phải token hết hạn.
        // So cả owner/token/timestamp để không xóa dòng vừa được browser refresh trong lúc gửi.
        const { data: removed, error: removeError } = await admin.from("user_push_tokens").delete()
          .eq("id", row.id).eq("user_id", input.userId).eq("token", row.token)
          .eq("updated_at", row.updated_at).select("id");
        if (removeError) result.cleanupFailedIds.push(row.id);
        else result.removedTokens += removed?.length ?? 0;
      }
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < 500) break;
  }
  // accepted chỉ nghĩa FCM đã nhận, không chứng minh thiết bị đã hiển thị/đọc.
  // Không tự retry cả batch: có thể gửi trùng; worker/outbox bước sau sẽ quyết định retry từng lỗi.
  return result;
}

export const FirebaseAdminService = { sendToUser };
