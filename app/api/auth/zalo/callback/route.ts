import { decodeZaloFlow, ZALO_FLOW_COOKIE } from "@/lib/auth/zalo-flow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasGoogleIdentity, linkZaloAccount, loginWithVerifiedZalo } from "@/services/zalo-account.service";
import { ZaloAuthService } from "@/services/zalo.service";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

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
    const code = request.nextUrl.searchParams.get("code");
    if (!code || !state) {
      return NextResponse.json({ error: 'code or state params does not exist !' }, { status: 400 });
    }
    console.log("flow.state: ", flow?.state);
    console.log("flow.code_verifier: ", flow?.code_verifier)
    if (!flow || !state || state !== flow.state) {
      return NextResponse.json({ error: "Phiên xác thực không hợp lệ hoặc đã hết hạn. Vui lòng bắt đầu lại." }, { status: 400 });
    }
    linking = flow.mode === "link";
    // Consume intent. An interrupted linking flow can never become a login flow.
    jar.delete(ZALO_FLOW_COOKIE);
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
    const token = await ZaloAuthService.getZaloAccessToken(code, flow.code_verifier);
    const profile = await ZaloAuthService.getZaloProfile(token.access_token);
    // if (!/^\d{1,64}$/.test(profile.id)) throw new Error("INVALID_ZALO_ID"); // This token is already checked inside the getZaloAccesstToken() function 
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
    console.log("Cannot login to Zalo: ", message)
    return NextResponse.json({ error: "Không thể hoàn tất đăng nhập Zalo. Vui lòng thử lại." }, { status: 500 });
  }
}
