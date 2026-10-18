import { decodeZaloFlow, ZALO_FLOW_COOKIE } from "@/lib/auth/zalo-flow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ZaloAccountService } from "@/services/zalo-account.service";
import { ZaloProviderService } from "@/services/zalo-provider.service";
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
    // Kiểm tra state trước khi xử lý cả callback thành công lẫn bị hủy.
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
    // If the coming request is for linking Zalo as the second authentication method
    if (linking) {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user || data.user.id !== flow.userId || !ZaloAccountService.hasGoogleIdentity(data.user)) {
        return accountResult(request, "session_changed");
      }
    }

    const token = await ZaloProviderService.getZaloAccessToken(code, flow.code_verifier);
    const profile = await ZaloProviderService.getZaloProfile(token.access_token);
    const admin = createAdminClient();

    // If the coming request is for linking Zalo as the second authentication method
    if (linking) {
      await ZaloAccountService.linkZaloAccount(admin, profile.id, flow.userId!);
      return accountResult(request, "success");
    }

    await ZaloAccountService.loginWithVerifiedZalo(admin, client, profile);
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
    console.log("[api/auth/zalo/callback] Cannot login to Zalo: ", error)
    return NextResponse.json({ error: "Không thể hoàn tất đăng nhập Zalo. Vui lòng thử lại." }, { status: 500 });
  }
}
