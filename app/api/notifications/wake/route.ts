import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOrigin } from "@/lib/http/request-origin";
import { runNotificationWorker } from "@/services/notification-worker.service";

export const runtime = "nodejs";
export const maxDuration = 25;

// Tín hiệu nhanh sau checkout. Header chỉ một order UUID; không nhận message/người nhận từ client.
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!isSameOrigin(request)) return NextResponse.json({ code: "INVALID_ORIGIN" }, { status: 403, headers });
  const orderId = request.headers.get("x-order-id") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json({ code: "INVALID_ORDER" }, { status: 400, headers });
  }
  try {
    const session = await createClient();
    const { data: { user }, error } = await session.auth.getUser();
    if (error || !user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401, headers });
    const admin = createAdminClient();
    const { data: order, error: lookupError } = await admin.from("orders").select("id")
      .eq("id", orderId).eq("student_id", user.id).eq("order_status", "pending")
      .gte("created_at", new Date(Date.now() - 60_000).toISOString()).maybeSingle();
    if (lookupError) throw new Error("LOOKUP_FAILED");
    if (!order) return NextResponse.json({ code: "ORDER_NOT_ELIGIBLE" }, { status: 403, headers });
    // DB slot giới hạn concurrency và cooldown toàn hệ thống; gọi trùng không nhân số lần gửi.
    after(async () => {
      try { await runNotificationWorker(); }
      catch { console.error("[notifications] Wake failed; cron will recover pending work."); }
    });
    return NextResponse.json({ scheduled: true }, { status: 202, headers });
  } catch {
    return NextResponse.json({ code: "WAKE_FAILED" }, { status: 503, headers });
  }
}
