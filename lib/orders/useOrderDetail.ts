"use client";

import { useMemo } from "react";
import { useStudentMockStore } from "@/store/useStudentMockStore";
import { toOrderDetail } from "@/lib/orders/order-mappers";

export function useOrderDetail(orderId: string) {
  const order = useStudentMockStore((state) => state.orderRecords[orderId]);

  const customerId = useStudentMockStore((state) => state.cart.student_id);

  return useMemo(() => {
    if (!order || order.student_id !== customerId) {
      return undefined;
    }

    return toOrderDetail(order);
  }, [order, customerId]);
}
