"use client";

import { create } from "zustand";
import type { AddCartItemInput } from "@/types/cart.types";

import { mockRestaurants, mockMenuItemDetails } from "@/lib/mocks/catalog.mock";

import {
  normalizeSelectedOptions,
  resolveSelectedOptions,
} from "@/lib/cart/options";
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

  addCatalogItem: (input: AddCartItemInput) => AddResult;

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

  addCatalogItem: (input) => {
    try {
      const restaurant = mockRestaurants.find(
        (entry) => entry.id === input.restaurant_id,
      );

      const menuItem = mockMenuItemDetails.find(
        (entry) =>
          entry.id === input.menu_item_id &&
          entry.restaurant_id === input.restaurant_id,
      );

      if (
        !restaurant ||
        restaurant.status !== "active" ||
        restaurant.operating_status !== "open"
      ) {
        return {
          ok: false,
          message: "Quán hiện không nhận đơn.",
        };
      }

      if (!menuItem?.is_active || !menuItem.is_available) {
        return {
          ok: false,
          message: "Món hiện không còn khả dụng.",
        };
      }

      if (!Number.isFinite(menuItem.price) || menuItem.price < 0) {
        return {
          ok: false,
          message: "Giá món không hợp lệ.",
        };
      }

      const selected = normalizeSelectedOptions(input.selected_options);

      // Kiểm tra nhóm bắt buộc, chọn một/chọn nhiều,
      // và tùy chọn có thực sự thuộc món hay không.
      const snapshots = resolveSelectedOptions(menuItem, selected);

      const kind = menuItem.category === "Nước uống" ? "drink" : "food";

      // Chuyển sang cấu trúc mà CartView hiện tại đang đọc.
      // Giá và tên lấy từ catalog, không lấy từ payload UI.
      return get().addItem(
        {
          id: restaurant.id,
          name: restaurant.name,
          location: restaurant.location ?? "",
          isOpen: true,
          kind,
        },
        {
          menuItemId: menuItem.id,
          name: menuItem.name,
          basePrice: menuItem.price,
          quantity: input.quantity,
          kind,
          image_url: menuItem.image_url,
          selected_options: selected,

          extras: snapshots.map((option) => ({
            id: option.option_id,
            name: `${option.group_name}: ${option.option_name}`,
            price: option.additional_price,
          })),

          // Chỉ là cấu trúc tương thích với cơ chế gộp dòng cũ.
          // Tất cả ID tùy chọn đều được đưa vào khóa gộp.
          selection: {
            toppingIds: selected.map((option) => option.option_id),
            sugarId: "",
            iceId: "",
          },

          // Không có ghi chú riêng cho món.
          note: "",
        },
      );
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Không thể thêm món vào giỏ hàng.",
      };
    }
  },

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
