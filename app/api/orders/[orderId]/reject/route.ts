import { approveOrder } from "@/lib/orders/approval-http";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  return approveOrder(request, params, "reject");
}
