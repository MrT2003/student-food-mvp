"use client";
import { useMemo } from "react";
import { useStudentMockStore } from "@/store/useStudentMockStore";
import { getCheckoutView } from "@/lib/orders/checkout-view";

export function useCheckout() {
  const records = useStudentMockStore((s) => s.orderRecords);
  const customerId = useStudentMockStore((s) => s.cart.student_id);
  const last = useStudentMockStore((s) => s.lastCheckout);
  return useMemo(() => getCheckoutView(records, customerId, last), [records, customerId, last]);
}
