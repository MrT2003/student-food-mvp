import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeZaloFlow, ZALO_FLOW_COOKIE } from "@/lib/auth/zalo-flow";
import { ZaloAuthService } from "@/services/zalo.service";
import { hasGoogleIdentity, linkZaloAccount, loginWithVerifiedZalo } from "@/services/zalo-account.service";

function accountResult(request: NextRequest, result: string) {
  const response = NextResponse.redirect(new URL("/account?zalo_link=" + result, request.url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  let linking = false;
  try {
    const jar = await cookies();
    const flow = decodeZaloFlow(jar.get(ZALO_FLOW_COOKIE)?.value);
    const state = request.nextUrl.searchParams.get("state");
    if (!flow || !state || state !== flow.state) {
      return NextResponse.json({ error: "Phiên xác thực không hợp lệ hoặc đã hết hạn. Vui lòng bắt đầu lại." }, { status: 400 });
    }
    linking = flow.mode === "link";
    // Consume intent. An interrupted linking flow can never become a login flow.
    jar.delete(ZALO_FLOW_COOKIE);
    const code = request.nextUrl.searchParams.get("code");
    if (request.nextUrl.searchParams.has("error") || !code) {
      return linking ? accountResult(request, "cancelled")
        : NextResponse.redirect(new URL("/auth/login", request.url));
    }

    const client = await createClient();
    if (linking) {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user || data.user.id !== flow.userId || !hasGoogleIdentity(data.user)) {
        return accountResult(request, "session_changed");
      }
    }
    const token = await ZaloAuthService.getZaloAccessToken(code, flow.verifier);
    const profile = await ZaloAuthService.getZaloProfile(token.access_token);
    if (!/^\d{1,64}$/.test(profile.id)) throw new Error("INVALID_ZALO_ID");
    const admin = createAdminClient();

    if (linking) {
      await linkZaloAccount(admin, profile.id, flow.userId!);
      return accountResult(request, "success");
    }
    await loginWithVerifiedZalo(admin, client, profile);
    const response = NextResponse.redirect(new URL("/", request.url));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "message" in error ? error.message : "";
    if (linking) {
      const result = message === "ZALO_ALREADY_LINKED" || message === "ACCOUNT_ALREADY_HAS_ZALO"
        ? "conflict" : "failed";
      return accountResult(request, result);
    }
    return NextResponse.json({ error: "Không thể hoàn tất đăng nhập Zalo. Vui lòng thử lại." }, { status: 500 });
  }
}
