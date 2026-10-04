"use client";

import { create } from "zustand";
import type {
  CartItem,
  CartRestaurant,
  CartSelection,
} from "@/lib/cart/mock-data";

type PaymentMethod = "bank" | "cash";

type RestaurantPreference = {
  payment: PaymentMethod;
  note: string;
};

type AddCartItem = Omit<
  CartItem,
  "id" | "restaurantId" | "menuItemId" | "selection"
> & {
  menuItemId: string;
  selection: CartSelection;
};

type AddResult = { ok: true } | { ok: false; message: string };

type CartState = {
  items: CartItem[];
  restaurants: CartRestaurant[];
  location: string;
  address: string;
  preferences: Partial<Record<string, RestaurantPreference>>;

  addItem: (restaurant: CartRestaurant, item: AddCartItem) => AddResult;

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

export const useCartStore = create<CartState>((set, get) => ({
  // Không tự thêm các món mẫu vào giỏ.
  items: [],
  restaurants: [],
  location: "KTX A",
  address: "",
  preferences: {},

  addItem: (restaurant, item) => {
    if (!restaurant.isOpen) {
      return {
        ok: false,
        message: "Quán đang tạm đóng cửa.",
      };
    }

    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      return {
        ok: false,
        message: "Số lượng phải từ 1 đến 99.",
      };
    }

    const selection: CartSelection = {
      toppingIds: [...new Set(item.selection.toppingIds)].sort(),
      sugarId: item.selection.sugarId,
      iceId: item.selection.iceId,
    };

    // Cùng quán + cùng món + cùng tùy chọn → cộng số lượng.
    // Khác topping/đường/đá → tạo dòng riêng.
    const id = JSON.stringify([
      restaurant.id,
      item.menuItemId,
      selection.toppingIds,
      selection.sugarId,
      selection.iceId,
      item.note.trim(),
    ]);

    const existing = get().items.find((entry) => entry.id === id);

    if ((existing?.quantity ?? 0) + item.quantity > 99) {
      return {
        ok: false,
        message: "Mỗi cấu hình món chỉ được tối đa 99 phần.",
      };
    }

    const nextItem: CartItem = {
      ...item,
      id,
      restaurantId: restaurant.id,
      selection,
      note: item.note.trim(),
      extras: item.extras.map((extra) => ({ ...extra })),
      quantity: (existing?.quantity ?? 0) + item.quantity,
    };

    set((state) => ({
      items: existing
        ? state.items.map((entry) => (entry.id === id ? nextItem : entry))
        : [...state.items, nextItem],

      restaurants: state.restaurants.some((entry) => entry.id === restaurant.id)
        ? state.restaurants.map((entry) =>
            entry.id === restaurant.id ? { ...restaurant } : entry,
          )
        : [...state.restaurants, { ...restaurant }],
    }));

    return { ok: true };
  },

  setItems: (update) =>
    set((state) => ({
      items: typeof update === "function" ? update(state.items) : update,
    })),

  setLocation: (location) => set({ location }),
  setAddress: (address) => set({ address }),

  setPreference: (restaurantId, update) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        [restaurantId]: {
          payment: "cash",
          note: "",
          ...state.preferences[restaurantId],
          ...update,
        },
      },
    })),
}));
