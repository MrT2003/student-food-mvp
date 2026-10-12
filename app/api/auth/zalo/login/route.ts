import { NextResponse } from "next/server";
import { beginZaloFlow } from "@/lib/auth/zalo-flow";

export async function GET() {
  try {
    const authorizationUrl = await beginZaloFlow()
    const response = NextResponse.redirect(authorizationUrl);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ error: "Chưa thể bắt đầu đăng nhập Zalo." }, { status: 503 });
  }
}
