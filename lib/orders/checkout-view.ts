import type { OrderDetail } from "@/types/order.types";
import { toOrderDetail } from "@/lib/orders/order-mappers";

// Derived on demand; no duplicate order snapshots in the store.
export function getCheckoutView(
  records: Record<string, OrderDetail>,
  studentId: string,
  last: { sessionId: string; location: string; address: string } | null,
) {
  if (!last) return null;
  const orders = Object.values(records)
    .filter((order) => order.student_id === studentId && order.session_checkout_id === last.sessionId)
    .map((order) => ({ ...toOrderDetail(order), paymentMethod: order.payment_method }));
  return { location: last.location, address: last.address, orders };
}
