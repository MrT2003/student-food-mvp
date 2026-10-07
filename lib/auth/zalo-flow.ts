import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ZaloAuthService } from "@/services/zalo.service";

export const ZALO_FLOW_COOKIE = "sf_zalo_flow";
type ZaloFlow = {
  mode: "login" | "link";
  userId: string | null;
  state: string;
  verifier: string;
  expiresAt: number;
};

function signature(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("AUTH_CONFIGURATION_MISSING");
  return createHmac("sha256", secret).update("zalo-flow:" + payload).digest();
}

export function encodeZaloFlow(flow: ZaloFlow): string {
  const payload = Buffer.from(JSON.stringify(flow)).toString("base64url");
  return payload + "." + signature(payload).toString("base64url");
}

export function decodeZaloFlow(value?: string): ZaloFlow | null {
  if (!value || value.length > 4096) return null;
  try {
    const parts = value.split(".");
    if (parts.length !== 2) return null;
    const [payload, mac] = parts;
    const actual = Buffer.from(mac, "base64url");
    const expected = signature(payload);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const flow = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!flow || !["login", "link"].includes(flow.mode) ||
      typeof flow.state !== "string" || typeof flow.verifier !== "string" ||
      !Number.isFinite(flow.expiresAt) || flow.expiresAt <= Date.now() ||
      (flow.mode === "link" && (typeof flow.userId !== "string" || !flow.userId)) ||
      (flow.mode === "login" && flow.userId !== null)) return null;
    return flow;
  } catch { return null; }
}

export async function beginZaloFlow(userId: string | null = null) {
  const verifier = ZaloAuthService.generateCodeVerifier();
  const flow: ZaloFlow = {
    mode: userId ? "link" : "login", userId, verifier,
    state: randomBytes(32).toString("hex"), expiresAt: Date.now() + 600_000,
  };
  const url = ZaloAuthService.getAuthorizationUrl(
    ZaloAuthService.generateCodeChallenge(verifier), flow.state,
  );
  const jar = await cookies();
  jar.set(ZALO_FLOW_COOKIE, encodeZaloFlow(flow), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 600,
  });
  return url;
}
