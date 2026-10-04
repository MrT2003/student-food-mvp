"use client";

import { create } from "zustand";
import type { CartItem } from "@/lib/cart/mock-data";

export type PreviewOrder = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantLocation: string;
  kind: "food" | "drink";
  quantity: number;
  total: number;
  payment: "bank" | "cash";
  note: string;
  items: CartItem[];
};

// Mỗi đơn giữ riêng thông tin của lần đặt đó.
export type SavedPreviewOrder = PreviewOrder & {
  createdAt: string;
  deliveryLocation: string;
  deliveryAddress: string;
  deliveryFee: number;
};

type CheckoutInput = {
  location: string;
  address: string;
  orders: Omit<PreviewOrder, "id">[];
};

type CheckoutSnapshot = {
  location: string;
  address: string;
  orders: SavedPreviewOrder[];
};

type OrderPreviewState = {
  // Chỉ dùng cho màn hình đặt hàng thành công.
  checkout: CheckoutSnapshot | null;

  // Toàn bộ đơn đã tạo trong phiên.
  ordersById: Record<string, SavedPreviewOrder>;

  // Mới nhất đứng trước.
  orderIds: string[];

  nextOrderNumber: number;
  saveCheckoutPreview: (input: CheckoutInput) => void;
};

function cloneCartItem(item: CartItem): CartItem {
  return {
    ...item,
    extras: item.extras.map((extra) => ({ ...extra })),
    selection: item.selection
      ? {
          ...item.selection,
          toppingIds: [...item.selection.toppingIds],
        }
      : undefined,
  };
}

export const useOrderPreviewStore = create<OrderPreviewState>((set) => ({
  checkout: null,
  ordersById: {},
  orderIds: [],
  nextOrderNumber: 123,

  saveCheckoutPreview: (input) => {
    if (input.orders.length === 0) return;

    set((state) => {
      const createdAt = new Date().toISOString();
      const location = input.location.trim();
      const address = input.address.trim();

      const newOrders: SavedPreviewOrder[] = input.orders.map(
        (order, index) => ({
          ...order,

          // Mã preview; backend sẽ cấp ID khi tích hợp API.
          id: `SF${String(state.nextOrderNumber + index).padStart(5, "0")}`,

          createdAt,
          deliveryLocation: location,
          deliveryAddress: address,
          deliveryFee: 0,
          items: order.items.map(cloneCartItem),
        }),
      );

      // Giữ các đơn cũ, chỉ thêm đơn mới.
      const ordersById = { ...state.ordersById };

      for (const order of newOrders) {
        ordersById[order.id] = order;
      }

      return {
        checkout: {
          location,
          address,
          orders: newOrders,
        },

        ordersById,

        orderIds: [...newOrders.map((order) => order.id), ...state.orderIds],

        nextOrderNumber: state.nextOrderNumber + newOrders.length,
      };
    });
  },
}));
