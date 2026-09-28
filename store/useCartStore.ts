"use client";

import { create } from "zustand";
import { initialCartItems, type CartItem } from "@/lib/cart/mock-data";

type PaymentMethod = "bank" | "cash";

type RestaurantPreference = {
  payment: PaymentMethod;
  note: string;
};

type CartState = {
  items: CartItem[];
  location: string;
  address: string;
  preferences: Partial<Record<string, RestaurantPreference>>;

  setItems: (
    update: CartItem[] | ((current: CartItem[]) => CartItem[]),
  ) => void;

  setLocation: (value: string) => void;
  setAddress: (value: string) => void;

  setPreference: (
    restaurantId: string,
    update: Partial<RestaurantPreference>,
  ) => void;
};

export const useCartStore = create<CartState>((set) => ({
  items: initialCartItems.map((item) => ({
    ...item,
    extras: item.extras.map((extra) => ({ ...extra })),
  })),

  location: "KTX A",
  address: "Cổng B, Phòng 302, gần căn tin",

  // Giá trị mẫu để hiển thị như thiết kế.
  preferences: {
    "com-co-ba": {
      payment: "bank",
      note: "Ít cay, nhiều rau",
    },
    "tra-sua-nha-lam": {
      payment: "cash",
      note: "Ít đá, không quá ngọt",
    },
  },

  setItems: (update) =>
    set((state) => ({
      items: typeof update === "function" ? update(state.items) : update,
    })),

  setLocation: (location) => set({ location }),

  setAddress: (address) => set({ address }),

  setPreference: (restaurantId, update) =>
    set((state) => {
      const current = state.preferences[restaurantId] ?? {
        payment: "cash",
        note: "",
      };

      return {
        preferences: {
          ...state.preferences,
          [restaurantId]: {
            ...current,
            ...update,
          },
        },
      };
    }),
}));
