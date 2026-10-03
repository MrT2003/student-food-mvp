"use client";

import { create } from "zustand";

import type { AddCartItemInput, Cart, CartItem } from "@/types/cart.types";

import type {
  CheckoutResult,
  CreateCheckoutInput,
  OrderDetail,
} from "@/types/order.types";

import type {
  CartItem as CartItemView,
  CartRestaurant,
} from "@/lib/cart/mock-data";

import {
  projectCart,
  projectOrder,
  type SavedPreviewOrder,
} from "@/lib/orders/preview-adapter";

import { mockRestaurants, mockMenuItemDetails } from "@/lib/mocks/catalog.mock";

import {
  createOptionHash,
  normalizeSelectedOptions,
  getEstimatedUnitPrice,
} from "@/lib/cart/options";

import { simulateCheckout } from "@/lib/mocks/checkout.mock";

// Tài khoản fixture, chỉ dùng khi test frontend.
// Không phải thông tin xác thực hoặc phân quyền thật.
const MOCK_CUSTOMER = {
  id: "50000000-0000-4000-8000-000000000001",
  role: "student",
  status: "active",
} as const;

const initialCart: Cart = {
  id: "60000000-0000-4000-8000-000000000001",
  student_id: MOCK_CUSTOMER.id,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
};

type RestaurantPreference = {
  payment: "bank" | "cash";
  note: string;
};

type ActionResult = { ok: true } | { ok: false; message: string };

type CheckoutActionResult =
  | { ok: true; result: CheckoutResult }
  | { ok: false; message: string };

type CheckoutView = {
  location: string;
  address: string;
  orders: SavedPreviewOrder[];
};

type StudentMockState = {
  // Dữ liệu gốc theo schema.
  cart: Cart;
  cart_items: CartItem[];
  orderRecords: Record<string, OrderDetail>;
  lastCheckoutResult: CheckoutResult | null;

  // Dữ liệu hiển thị để giữ tương thích UI hiện tại.
  items: CartItemView[];
  restaurants: CartRestaurant[];
  ordersById: Record<string, SavedPreviewOrder>;
  orderIds: string[];
  checkout: CheckoutView | null;

  // State của form, không phải cấu trúc bảng.
  location: string;
  address: string;
  preferences: Partial<Record<string, RestaurantPreference>>;

  addCatalogItem: (input: AddCartItemInput) => ActionResult;

  // Lớp tương thích: chỉ cho phép đổi số lượng/xóa dòng.
  setItems: (
    update: CartItemView[] | ((current: CartItemView[]) => CartItemView[]),
  ) => void;

  setLocation: (value: string) => void;
  setAddress: (value: string) => void;

  setPreference: (
    restaurantId: string,
    update: Partial<RestaurantPreference>,
  ) => void;

  checkoutCart: () => CheckoutActionResult;
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Có lỗi xảy ra. Vui lòng thử lại.";
}

function validateQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new Error("Số lượng phải từ 1 đến 99.");
  }
}

export const useStudentMockStore = create<StudentMockState>((set, get) => {
  function commitCart(rows: CartItem[]) {
    // Tính xong toàn bộ trước khi thay đổi state.
    const view = projectCart(rows);
    const activeRestaurantIds = new Set(rows.map((row) => row.restaurant_id));

    const preferences: StudentMockState["preferences"] = {};

    for (const [id, preference] of Object.entries(get().preferences)) {
      if (preference && activeRestaurantIds.has(id)) {
        preferences[id] = preference;
      }
    }

    set({
      cart_items: rows,
      items: view.items,
      restaurants: view.restaurants,
      preferences,
      cart: {
        ...get().cart,
        updated_at: new Date().toISOString(),
      },
    });
  }

  return {
    cart: initialCart,
    cart_items: [],
    orderRecords: {},
    lastCheckoutResult: null,

    items: [],
    restaurants: [],
    ordersById: {},
    orderIds: [],
    checkout: null,

    location: "KTX A",
    address: "",
    preferences: {},

    addCatalogItem: (input) => {
      try {
        validateQuantity(input.quantity);

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
          throw new Error("Quán hiện không nhận đơn.");
        }

        if (!menuItem?.is_active || !menuItem.is_available) {
          throw new Error("Món hiện không còn khả dụng.");
        }

        const selected = normalizeSelectedOptions(input.selected_options);

        // Kiểm tra giá và tính hợp lệ của tùy chọn.
        getEstimatedUnitPrice(menuItem, selected);

        const hash = createOptionHash(selected);
        const state = get();

        const existing = state.cart_items.find(
          (row) =>
            row.restaurant_id === restaurant.id &&
            row.menu_item_id === menuItem.id &&
            row.option_hash === hash,
        );

        const quantity = (existing?.quantity ?? 0) + input.quantity;

        validateQuantity(quantity);

        const now = new Date().toISOString();

        const row: CartItem = {
          id: existing?.id ?? crypto.randomUUID(),
          cart_id: state.cart.id,
          restaurant_id: restaurant.id,
          menu_item_id: menuItem.id,
          quantity,
          option_hash: hash,
          selected_options: selected,
          created_at: existing?.created_at ?? now,
          updated_at: now,
        };

        const rows = existing
          ? state.cart_items.map((entry) =>
              entry.id === existing.id ? row : entry,
            )
          : [...state.cart_items, row];

        commitCart(rows);

        return { ok: true };
      } catch (error) {
        return { ok: false, message: errorMessage(error) };
      }
    },

    setItems: (update) => {
      const state = get();

      const requested =
        typeof update === "function" ? update(state.items) : update;

      const ids = new Set<string>();
      const now = new Date().toISOString();

      const rows = requested.map((item) => {
        if (ids.has(item.id)) {
          throw new Error("Dòng giỏ hàng bị trùng.");
        }

        ids.add(item.id);

        const existing = state.cart_items.find((row) => row.id === item.id);

        if (!existing) {
          throw new Error("Dùng addCatalogItem để thêm món mới.");
        }

        validateQuantity(item.quantity);

        // Không nhận tên/giá/tùy chọn bị sửa từ UI cũ.
        return {
          ...existing,
          quantity: item.quantity,
          updated_at:
            item.quantity === existing.quantity ? existing.updated_at : now,
        };
      });

      commitCart(rows);
    },

    setLocation: (location) => set({ location }),
    setAddress: (address) => set({ address }),

    setPreference: (restaurantId, update) => {
      if (
        !get().cart_items.some((item) => item.restaurant_id === restaurantId)
      ) {
        return;
      }

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
      }));
    },

    checkoutCart: () => {
      try {
        const state = get();
        const location = state.location.trim();
        const address = state.address.trim();

        if (!location || !address) {
          throw new Error("Vui lòng nhập đầy đủ địa chỉ nhận hàng.");
        }

        const restaurantIds = [
          ...new Set(state.cart_items.map((item) => item.restaurant_id)),
        ];

        const input: CreateCheckoutInput = {
          p_delivery_address: `${location}, ${address}`,
          p_restaurant_preferences: restaurantIds.map((id) => {
            const preference = state.preferences[id];

            return {
              restaurant_id: id,
              payment_method:
                preference?.payment === "bank" ? "bank_transfer" : "cash",
              customer_notes: preference?.note.trim() || null,
            };
          }),
        };

        const output = simulateCheckout(input, {
          customer: MOCK_CUSTOMER,
          cart: state.cart,
          cart_items: state.cart_items,
          restaurants: mockRestaurants,
          menu_items: mockMenuItemDetails,
        });

        const newOrderViews = output.created_orders.map((order) =>
          projectOrder(order, location, address),
        );

        const orderRecords = { ...state.orderRecords };
        const ordersById = { ...state.ordersById };

        for (const order of output.created_orders) {
          orderRecords[order.id] = order;
        }

        for (const order of newOrderViews) {
          ordersById[order.id] = order;
        }

        // Một lần cập nhật: lưu toàn bộ đơn và xóa giỏ.
        // Nếu simulateCheckout/projectOrder lỗi, chưa đổi state.
        set({
          orderRecords,
          ordersById,
          orderIds: [
            ...output.created_orders.map((order) => order.id),
            ...state.orderIds,
          ],
          lastCheckoutResult: output.result,
          checkout: {
            location,
            address,
            orders: newOrderViews,
          },
          cart_items: [],
          items: [],
          restaurants: [],
          preferences: {},
          cart: {
            ...state.cart,
            updated_at: new Date().toISOString(),
          },
        });

        return {
          ok: true,
          result: output.result,
        };
      } catch (error) {
        return {
          ok: false,
          message: errorMessage(error),
        };
      }
    },
  };
});
