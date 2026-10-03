"use client";

import { useMemo } from "react";
import { useStudentMockStore } from "@/store/useStudentMockStore";
import { toOrderDetail } from "@/lib/orders/order-mappers";
import { isCurrentOrder, isHistoryOrder } from "@/lib/orders/order-detail";

export function useOrders() {
  const records = useStudentMockStore((state) => state.orderRecords);

  const customerId = useStudentMockStore((state) => state.cart.student_id);

  return useMemo(() => {
    const orders = Object.values(records)
      .filter((order) => order.student_id === customerId)
      .sort(
        (a, b) =>
          Date.parse(b.created_at) - Date.parse(a.created_at) ||
          a.id.localeCompare(b.id),
      )
      .map(toOrderDetail);

    return {
      orders,
      currentOrders: orders.filter((order) => isCurrentOrder(order.status)),
      historyOrders: orders.filter((order) => isHistoryOrder(order.status)),
    };
  }, [records, customerId]);
}
