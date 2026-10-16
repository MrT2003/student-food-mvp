import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const GOOGLE_LINK_COOKIE = "sf_google_link";

// Cookie ký tên giữ UUID khởi tạo; PKCE của Supabase bảo vệ code exchange riêng.
function sign(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("AUTH_CONFIGURATION_MISSING");
  return createHmac("sha256", secret).update("google-link:" + payload).digest();
}

export async function beginGoogleLink(userId: string) {
  const nonce = randomBytes(32).toString("hex");
  const payload = Buffer.from(JSON.stringify({ userId, nonce, expiresAt: Date.now() + 600_000 })).toString("base64url");
  (await cookies()).set(GOOGLE_LINK_COOKIE, payload + "." + sign(payload).toString("base64url"), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600,
  });
  return nonce;
}

// Fail closed khi cookie bị sửa/hết hạn hoặc callback không thuộc lần link này.
export function readGoogleLink(value: string | undefined, nonce: string | null): string | null {
  try {
    if (!value || value.length > 4096 || !nonce) return null;
    const parts = value.split(".");
    if (parts.length !== 2) return null;
    const actual = Buffer.from(parts[1], "base64url");
    const expected = sign(parts[0]);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const flow = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    return typeof flow.userId === "string" && flow.nonce === nonce && Number.isFinite(flow.expiresAt)
      && flow.expiresAt > Date.now() ? flow.userId : null;
  } catch { return null; }
}
