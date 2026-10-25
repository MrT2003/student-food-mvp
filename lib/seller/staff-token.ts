import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const purpose = "studentfood.staff-invite";
const lifetime = 300;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StaffTokenClaims = {
  purpose: typeof purpose;
  version: 1;
  restaurantId: string;
  issuedBy: string;
  iat: number;
  exp: number;
  nonce: string;
};

export class StaffTokenError extends Error {
  constructor(public readonly code: "STAFF_TOKEN_CONFIGURATION_MISSING" | "INVALID_STAFF_TOKEN" | "STAFF_TOKEN_EXPIRED") {
    super(code);
  }
}

function secret(): string {
  const value = process.env.STAFF_INVITATION_SECRET;
  // Khóa riêng cho tuyển staff, ít nhất 32 byte; không tái sử dụng credential Auth/DB.
  if (!value || Buffer.byteLength(value, "utf8") < 32
    || /REPLACE_WITH|CHANGE_ME|YOUR[_-]?(SECRET|KEY)|PLACEHOLDER|EXAMPLE[_-]?(SECRET|KEY)/i.test(value)
    || new Set(value).size < 8) throw new StaffTokenError("STAFF_TOKEN_CONFIGURATION_MISSING");
  return value;
}

function signature(payload: string): Buffer {
  // Cùng pattern HMAC của lib/auth, thuật toán cố định từ node:crypto, không nhận alg từ client.
  return createHmac("sha256", secret()).update(`${purpose}:v1:${payload}`).digest();
}

export function assertStaffTokenConfiguration(): void { secret(); }

export function issueStaffToken(restaurantId: string, issuedBy: string) {
  if (!uuid.test(restaurantId) || !uuid.test(issuedBy)) throw new StaffTokenError("INVALID_STAFF_TOKEN");
  const iat = Math.floor(Date.now() / 1000);
  const claims: StaffTokenClaims = {
    purpose, version: 1, restaurantId: restaurantId.toLowerCase(), issuedBy: issuedBy.toLowerCase(),
    iat, exp: iat + lifetime, nonce: randomBytes(32).toString("base64url"),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return { token: `${payload}.${signature(payload).toString("base64url")}`, expiresAt: new Date(claims.exp * 1000).toISOString() };
}

export function verifyStaffToken(token: unknown): StaffTokenClaims {
  if (typeof token !== "string" || token.length > 4096) throw new StaffTokenError("INVALID_STAFF_TOKEN");
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw new StaffTokenError("INVALID_STAFF_TOKEN");
  const [payload, mac] = parts;
  const expected = signature(payload);
  const actual = Buffer.from(mac, "base64url");
  if (actual.length !== expected.length || actual.toString("base64url") !== mac || !timingSafeEqual(actual, expected)) {
    throw new StaffTokenError("INVALID_STAFF_TOKEN");
  }
  let value;
  try { value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { throw new StaffTokenError("INVALID_STAFF_TOKEN"); }
  const fields = ["purpose", "version", "restaurantId", "issuedBy", "iat", "exp", "nonce"];
  const now = Math.floor(Date.now() / 1000);
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== fields.length || Object.keys(value).some((key) => !fields.includes(key))
    || value.purpose !== purpose || value.version !== 1
    || typeof value.restaurantId !== "string" || !uuid.test(value.restaurantId)
    || typeof value.issuedBy !== "string" || !uuid.test(value.issuedBy)
    || !Number.isSafeInteger(value.iat) || value.iat < 0 || value.iat > now
    || !Number.isSafeInteger(value.exp) || value.exp !== value.iat + lifetime
    || typeof value.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.nonce)) {
    throw new StaffTokenError("INVALID_STAFF_TOKEN");
  }
  if (value.exp <= now) throw new StaffTokenError("STAFF_TOKEN_EXPIRED");
  return { purpose, version: 1, restaurantId: value.restaurantId.toLowerCase(), issuedBy: value.issuedBy.toLowerCase(),
    iat: value.iat, exp: value.exp, nonce: value.nonce };
}
