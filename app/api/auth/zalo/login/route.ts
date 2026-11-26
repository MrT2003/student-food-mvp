import { beginZaloFlow } from "@/lib/auth/zalo-flow";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const authorizationUrl = await beginZaloFlow()
    console.debug("Zalo AuthorizationURL: ", authorizationUrl)
    const response = NextResponse.redirect(authorizationUrl);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Chưa thể bắt đầu đăng nhập Zalo"
    return NextResponse.json({ error: errorMsg }, { status: 503 });
  }
}


// export async function GET() {
//   try {
//     const authorizationUrl = await beginZaloFlow()
//     console.debug("Zalo AuthorizationURL: ", authorizationUrl)
//     return NextResponse.json({"authorizationURl": authorizationUrl})
//   } catch (error: unknown) {
//     const errorMsg = error instanceof Error ? error.message : "Chưa thể bắt đầu đăng nhập Zalo"
//     return NextResponse.json({ error: errorMsg }, { status: 503 });
//   }
// }