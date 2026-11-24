import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOrigin } from "@/lib/http/request-origin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function owner() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user?.id;
}
// Admin chỉ dùng phía server. Mọi query đều buộc user_id từ session, không nhận từ body.
export async function GET(request: Request) {
  try {
    const userId = await owner();
    if (!userId) return reply({ error: "Vui lòng đăng nhập." }, 401);
    const url = new URL(request.url);
    const list = url.searchParams.get("list") === "1";
    const cursor = url.searchParams.get("cursor");
    let before: { created_at: string; id: string } | null = null;
    if (cursor) {
      try { before = JSON.parse(cursor); } catch { return reply({ error: "Cursor không hợp lệ." }, 400); }
      if (!before || !UUID.test(before.id) || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(before.created_at) || !Number.isFinite(Date.parse(before.created_at))) return reply({ error: "Cursor không hợp lệ." }, 400);
    }
    const admin = createAdminClient();
    const countRequest = admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", false);
    let query = admin.from("notifications").select("id,title,content,type,related_order_id,is_read,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(21);
    if (before) query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
    const [count, rows] = await Promise.all([countRequest, list ? query : Promise.resolve(null)]);
    if (count.error || rows?.error) throw new Error("READ_FAILED");
    const items = rows?.data?.slice(0, 20) ?? [];
    const last = items.at(-1);
    return reply({ unreadCount: count.count ?? 0, ...(list ? { items, nextCursor: (rows?.data?.length ?? 0) > 20 && last ? JSON.stringify({ created_at: last.created_at, id: last.id }) : null } : {}) });
  } catch { return reply({ error: "Chưa tải được thông báo. Vui lòng thử lại." }, 503); }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return reply({ error: "Yêu cầu không hợp lệ." }, 403);
  try {
    const userId = await owner();
    if (!userId) return reply({ error: "Vui lòng đăng nhập." }, 401);
    const body = await request.json();
    if (body.all !== true && (typeof body.id !== "string" || !UUID.test(body.id))) return reply({ error: "Mã thông báo không hợp lệ." }, 400);
    const admin = createAdminClient();
    // Gọi lặp an toàn: chỉ đổi false → true; không sửa title, người nhận hay nội dung.
    let update = admin.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    if (body.all !== true) update = update.eq("id", body.id);
    const { error } = await update;
    if (error) throw error;
    const count = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", false);
    if (count.error) throw count.error;
    return reply({ unreadCount: count.count ?? 0 });
  } catch { return reply({ error: "Chưa lưu được trạng thái đã đọc. Vui lòng thử lại." }, 503); }
}
