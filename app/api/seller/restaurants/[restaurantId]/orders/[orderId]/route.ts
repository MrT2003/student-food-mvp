import { readSellerOrders } from "@/lib/seller/orders-http";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ restaurantId: string; orderId: string }> }) {
  return readSellerOrders(params);
}
