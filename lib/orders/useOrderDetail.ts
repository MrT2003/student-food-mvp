"use client";

import { useMemo } from "react";
import { useOrderPreviewStore } from "@/store/useOrderPreviewStore";
import { findMockOrderDetail } from "@/lib/orders/order-detail";
import { toOrderDetail } from "@/lib/orders/order-mappers";

export function useOrderDetail(orderId: string) {
  // Chỉ đăng ký theo dõi đúng đơn đang mở.
  const savedOrder = useOrderPreviewStore((state) => state.ordersById[orderId]);

  return useMemo(() => {
    if (savedOrder) {
      return toOrderDetail(savedOrder);
    }

    // Giữ khả năng xem các đơn demo có sẵn.
    return findMockOrderDetail(orderId);
  }, [savedOrder, orderId]);
}
