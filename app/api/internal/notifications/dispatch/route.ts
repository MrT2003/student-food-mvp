import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runNotificationWorker } from "@/services/notification-worker.service";

export const runtime = "nodejs";
export const maxDuration = 25;

// cron-job.org gọi POST và chờ kết quả; không trả 200 giả trước khi xử lý xong.
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const secret = process.env.NOTIFICATION_WORKER_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ code: "WORKER_NOT_CONFIGURED" }, { status: 503, headers });
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected)
      || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401, headers });
  }
  try {
    return NextResponse.json(await runNotificationWorker(), { headers });
  } catch {
    // Không log lỗi SDK/DB thô hoặc payload/token; cron lưu được HTTP 503 để theo dõi.
    return NextResponse.json({ code: "NOTIFICATION_WORKER_FAILED" }, { status: 503, headers });
  }
}
