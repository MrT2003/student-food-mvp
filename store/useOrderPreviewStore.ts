"use client";

import { create } from "zustand";
import type { CartItem } from "@/lib/cart/mock-data";

export type PreviewOrder = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  kind: "food" | "drink";
  quantity: number;
  total: number;
  payment: "bank" | "cash";
  note: string;
  items: CartItem[];
};

type CheckoutInput = {
  location: string;
  address: string;
  orders: Omit<PreviewOrder, "id">[];
};

type CheckoutSnapshot = {
  location: string;
  address: string;
  orders: PreviewOrder[];
};

type OrderPreviewState = {
  checkout: CheckoutSnapshot | null;
  nextOrderNumber: number;
  saveCheckoutPreview: (input: CheckoutInput) => void;
};

export const useOrderPreviewStore = create<OrderPreviewState>((set) => ({
  checkout: null,
  nextOrderNumber: 123,

  saveCheckoutPreview: (input) =>
    set((state) => ({
      checkout: {
        location: input.location,
        address: input.address.trim(),
        orders: input.orders.map((order, index) => ({
          ...order,

          // Mã đơn giả lập dành riêng cho UI.
          id: `SF${String(state.nextOrderNumber + index).padStart(5, "0")}`,

          // Sao chép dữ liệu để thay đổi Cart không làm đổi kết quả này.
          items: order.items.map((item) => ({
            ...item,
            extras: item.extras.map((extra) => ({ ...extra })),
          })),
        })),
      },
      nextOrderNumber: state.nextOrderNumber + input.orders.length,
    })),
}));