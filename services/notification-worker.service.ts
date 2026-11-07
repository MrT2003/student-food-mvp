import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { FirebaseAdminService, type ClaimedPushDelivery } from "./firebase-admin.service";

// Một invocation xử lý một batch. Cron tiếp theo tiếp tục backlog, không while(true)/sleep trên Vercel.
export async function runNotificationWorker() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_restaurant_notifications");
  if (error) throw new Error("NOTIFICATION_CLAIM_FAILED");
  const batch = data as { busy: boolean; leaseId?: string; jobs: ClaimedPushDelivery[] };
  if (batch.busy) return { busy: true, attempted: 0, accepted: 0, retry: 0, failed: 0 };
  if (!batch.leaseId || !Array.isArray(batch.jobs)) throw new Error("NOTIFICATION_CLAIM_INVALID");
  const results = await FirebaseAdminService.sendClaimedDeliveries(batch.jobs);
  // Lưu kết quả kể cả batch rỗng để release slot và cleanup. Ack lỗi -> lease recovery, có thể gửi trùng.
  const { error: finishError } = await admin.rpc("finish_restaurant_notifications", {
    p_lease_id: batch.leaseId, p_results: results,
  });
  if (finishError) throw new Error("NOTIFICATION_ACK_FAILED");
  return { busy: false, attempted: results.length,
    accepted: results.filter((row) => row.outcome === "accepted").length,
    retry: results.filter((row) => row.outcome === "retry").length,
    failed: results.filter((row) => row.outcome === "failed").length };
}
