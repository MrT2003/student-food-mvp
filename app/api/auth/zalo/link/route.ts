import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { beginZaloFlow } from "@/lib/auth/zalo-flow";
import { hasGoogleIdentity } from "@/services/zalo-account.service";

export async function GET() {
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
    const { data: linked, error: linkedError } = await createAdminClient().from("user_zalo_identities")
      .select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (linkedError) throw linkedError;
    return NextResponse.json({
      userId: data.user.id,
      google: hasGoogleIdentity(data.user),
      zalo: Boolean(linked) || /^\d{1,64}@zalo\.app$/.test(data.user.email ?? ""),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Chưa thể kiểm tra phương thức đăng nhập. Vui lòng thử lại sau." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
    if (!hasGoogleIdentity(data.user)) {
      return NextResponse.json({ error: "Tính năng này dành cho tài khoản đã liên kết Google." }, { status: 403 });
    }
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from("users")
      .select("status").eq("id", data.user.id).maybeSingle();
    if (profileError || profile?.status !== "active") {
      return NextResponse.json({ error: "Chưa thể xác minh hồ sơ tài khoản." }, { status: 403 });
    }
    // Fail before starting OAuth if migration/configuration is missing.
    const { data: linked, error: linkedError } = await admin.from("user_zalo_identities")
      .select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (linkedError) throw linkedError;
    if (linked) return NextResponse.json({ error: "Tài khoản đã liên kết Zalo." }, { status: 409 });
    return NextResponse.json({ url: await beginZaloFlow(data.user.id) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Chưa thể bắt đầu liên kết Zalo. Vui lòng thử lại sau." }, { status: 503 });
  }
}
