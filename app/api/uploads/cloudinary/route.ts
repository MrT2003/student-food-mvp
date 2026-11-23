import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/http/request-origin";
import { issueUpload, completeUpload, UploadError } from "@/services/cloudinary-server.service";
export const runtime = "nodejs";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return reply({ error: "Yêu cầu không hợp lệ." }, 403);
  try {
    // API chỉ nhận metadata nhỏ, không nhận file/base64 qua Vercel.
    const text = await request.text();
    if (text.length > 4096) return reply({ error: "Request quá lớn." }, 413);
    let input;
    try { input = JSON.parse(text); } catch { return reply({ error: "JSON không hợp lệ." }, 400); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return reply({ error: "Dữ liệu không hợp lệ." }, 400);
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return reply({ error: "Vui lòng đăng nhập lại." }, 401);
    if (input.action === "sign") return reply(await issueUpload(data.user.id, input));
    if (input.action === "complete") return reply(await completeUpload(data.user.id, input.intentId));
    return reply({ error: "Thao tác không hợp lệ." }, 400);
  } catch (error) {
    if (error instanceof UploadError) return reply({ error: error.message }, error.status);
    return reply({ error: "Chưa thể xử lý upload. Vui lòng thử lại." }, 503);
  }
}
