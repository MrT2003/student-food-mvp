"use client";

import { create } from "zustand";

import type {
  AddCartItemInput,
  Cart,
  CartItem,
  GetCartResult,
} from "@/types/cart.types";

import type {
  CheckoutResult,
  CreateCheckoutInput,
  OptionSnapshot,
  OrderDetail,
  OrderItem,
} from "@/types/order.types";

import { projectCart } from "@/lib/cart/view-model";
import { getCartItemUnitPrice } from "@/lib/cart/calculations";
import { createClient } from "@/lib/supabase/client";
import { CartServices, type AddToCartInput } from "@/services/cart.service";
import { OrderServices } from "@/services/order.service";

import { mockRestaurants, mockMenuItemDetails } from "@/lib/mocks/catalog.mock";

import {
  createOptionHash,
  normalizeSelectedOptions,
  getEstimatedUnitPrice,
} from "@/lib/cart/options";

import { simulateCheckout } from "@/lib/mocks/checkout.mock";
import { prepareReorder } from "@/lib/orders/reorder";
import {
  parseStudentSnapshot,
  studentStorageKey,
  type StudentSnapshot,
} from "@/lib/mocks/student-storage";

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

type StudentMockState = {
  hasHydrated: boolean;
  storageReadFailed: boolean;
  storageWarning: string | null;
  // Dữ liệu giỏ hàng trực tiếp từ Supabase khi đã đăng nhập.
  serverCart: GetCartResult | null;
  // Dữ liệu gốc theo schema.
  cart: Cart;
  cart_items: CartItem[];
  orderRecords: Record<string, OrderDetail>;
  lastCheckout: StudentSnapshot["lastCheckout"];

  // State của form, không phải cấu trúc bảng.
  location: string;
  address: string;
  preferences: Partial<Record<string, RestaurantPreference>>;

  syncFromDatabase: (userId?: string | null) => Promise<void>;
  addToDatabaseCart: (input: AddToCartInput) => Promise<ActionResult>;
  updateDatabaseCartQuantity: (
    id: string,
    quantity: number,
  ) => Promise<ActionResult>;
  removeDatabaseCartItem: (id: string) => Promise<ActionResult>;
  checkoutDatabaseCart: () => Promise<CheckoutActionResult>;

  addCatalogItem: (input: AddCartItemInput) => ActionResult;
  reorderOrder: (orderId: string) => ActionResult;

  updateCartItemQuantity: (id: string, quantity: number) => ActionResult;
  removeCartItem: (id: string) => ActionResult;

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

function mapRawOrderRow(raw: Record<string, unknown>): OrderDetail {
  const rawItems = Array.isArray(raw.order_items) ? raw.order_items : [];
  const parsedItems: OrderItem[] = rawItems.map((entry: unknown) => {
    const itemObj = (entry ?? {}) as Record<string, unknown>;
    const rawOptions =
      itemObj.selected_options ?? itemObj.option_snapshot_price ?? [];
    const selected_options: OptionSnapshot[] = Array.isArray(rawOptions)
      ? rawOptions.map((opt: unknown) => {
          const o = (opt ?? {}) as Record<string, unknown>;
          return {
            option_id: String(o.option_id ?? o.id ?? ""),
            group_name: String(o.group_name ?? ""),
            option_name: String(o.option_name ?? ""),
            additional_price: Number(o.additional_price ?? 0),
          };
        })
      : [];

    const hasTotalPrice =
      itemObj.total_price !== null &&
      itemObj.total_price !== undefined &&
      Number.isFinite(Number(itemObj.total_price));

    return {
      id: String(itemObj.id ?? ""),
      order_id: String(itemObj.order_id ?? raw.id ?? ""),
      menu_item_id:
        typeof itemObj.menu_item_id === "string" ? itemObj.menu_item_id : null,
      item_name_snapshot: String(itemObj.item_name_snapshot ?? ""),
      image_url:
        typeof itemObj.image_url === "string" ? itemObj.image_url : null,
      quantity: Number(itemObj.quantity ?? 1),
      unit_price_snapshot: hasTotalPrice
        ? Number(itemObj.total_price)
        : Number(itemObj.unit_price_snapshot ?? 0),
      selected_options,
    };
  });

  const orderSubtotal = Number(raw.subtotal ?? 0);
  const baseSum = parsedItems.reduce(
    (sum, it) => sum + it.unit_price_snapshot * it.quantity,
    0,
  );
  const withOptionsSum = parsedItems.reduce((sum, it) => {
    const extras = it.selected_options.reduce(
      (s, o) => s + o.additional_price,
      0,
    );
    return sum + (it.unit_price_snapshot + extras) * it.quantity;
  }, 0);

  // RPC create_checkout_orders lưu base_price vào unit_price_snapshot và phụ thu vào option_snapshot_price.
  // Nếu chưa có cột total_price và tổng gồm phụ thu khớp với subtotal của đơn, cộng phụ thu vào unit_price_snapshot.
  const normalizedItems =
    withOptionsSum === orderSubtotal && baseSum !== orderSubtotal
      ? parsedItems.map((it) => ({
          ...it,
          unit_price_snapshot:
            it.unit_price_snapshot +
            it.selected_options.reduce((s, o) => s + o.additional_price, 0),
        }))
      : parsedItems;

  const rawRestaurant = raw.restaurant as
    | { id?: string; name?: string; location?: string | null }
    | null
    | undefined;

  return {
    id: String(raw.id ?? ""),
    session_checkout_id: String(raw.session_checkout_id ?? ""),
    order_code: String(raw.order_code ?? ""),
    student_id: String(raw.student_id ?? ""),
    restaurant_id: String(raw.restaurant_id ?? ""),
    order_status: (raw.order_status as OrderDetail["order_status"]) ?? "pending",
    delivery_address:
      typeof raw.delivery_address === "string" ? raw.delivery_address : null,
    customer_notes:
      typeof raw.customer_notes === "string" ? raw.customer_notes : null,
    subtotal: orderSubtotal,
    total: Number(raw.total ?? orderSubtotal),
    payment_method:
      (raw.payment_method as OrderDetail["payment_method"]) ?? "cash",
    payment_confirmed_by:
      typeof raw.payment_confirmed_by === "string"
        ? raw.payment_confirmed_by
        : null,
    payment_confirmed_at:
      typeof raw.payment_confirmed_at === "string"
        ? raw.payment_confirmed_at
        : null,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    accepted_at:
      typeof raw.accepted_at === "string" ? raw.accepted_at : null,
    completed_at:
      typeof raw.completed_at === "string" ? raw.completed_at : null,
    order_items: normalizedItems,
    restaurant:
      rawRestaurant && typeof rawRestaurant.name === "string"
        ? {
            id: rawRestaurant.id,
            name: rawRestaurant.name,
            location: rawRestaurant.location ?? null,
          }
        : null,
  };
}

export const useStudentMockStore = create<StudentMockState>((set, get) => {
  function commitCart(rows: CartItem[]) {
    // Tính xong toàn bộ trước khi thay đổi state.
    projectCart(rows);
    const activeRestaurantIds = new Set(rows.map((row) => row.restaurant_id));

    const preferences: StudentMockState["preferences"] = {};

    for (const [id, preference] of Object.entries(get().preferences)) {
      if (preference && activeRestaurantIds.has(id)) {
        preferences[id] = preference;
      }
    }

    set({
      cart_items: rows,
      preferences,
      cart: {
        ...get().cart,
        updated_at: new Date().toISOString(),
      },
    });
  }

  return {
    hasHydrated: false,
    storageReadFailed: false,
    storageWarning: null,
    serverCart: null,
    cart: initialCart,
    cart_items: [],
    orderRecords: {},
    lastCheckout: null,

    location: "KTX A",
    address: "",
    preferences: {},

    syncFromDatabase: async (userId) => {
      try {
        const supabase = createClient();
        let uid = userId;
        if (uid === undefined) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          uid = user?.id ?? null;
        }

        if (!uid) {
          set({ serverCart: null });
          return;
        }

        const [cartResult, ordersResponse] = await Promise.all([
          CartServices.getCart(uid),
          supabase
            .from("orders")
            .select(
              "*, order_items(*), restaurant:restaurants(id, name, location)",
            )
            .eq("student_id", uid)
            .order("created_at", { ascending: false }),
        ]);

        const now = new Date().toISOString();
        const state = get();
        const nextCart: Cart = cartResult.cart ?? {
          id: state.cart.id,
          student_id: uid,
          created_at: state.cart.created_at,
          updated_at: now,
        };

        const mappedRows: CartItem[] = cartResult.items.map((item) => ({
          id: item.id,
          cart_id: nextCart.id,
          restaurant_id: item.restaurantId,
          menu_item_id: item.id,
          quantity: item.quantity,
          option_hash: "DB",
          selected_options: item.extras.map((extra) => ({
            option_id: extra.id,
          })),
          created_at: nextCart.created_at,
          updated_at: nextCart.updated_at,
        }));

        const activeRestaurantIds = new Set(
          mappedRows.map((row) => row.restaurant_id),
        );
        const preferences: StudentMockState["preferences"] = {};
        for (const [id, preference] of Object.entries(state.preferences)) {
          if (preference && activeRestaurantIds.has(id)) {
            preferences[id] = preference;
          }
        }

        const nextOrderRecords: Record<string, OrderDetail> = {
          ...state.orderRecords,
        };
        let recoveredLastCheckout = state.lastCheckout;
        if (Array.isArray(ordersResponse.data)) {
          for (const rawRow of ordersResponse.data) {
            const detail = mapRawOrderRow(rawRow as Record<string, unknown>);
            if (detail.id) {
              nextOrderRecords[detail.id] = detail;
              if (!recoveredLastCheckout && detail.session_checkout_id) {
                recoveredLastCheckout = {
                  sessionId: detail.session_checkout_id,
                  location: state.location,
                  address: detail.delivery_address ?? state.address,
                };
              }
            }
          }
        }

        set({
          serverCart: cartResult,
          cart: nextCart,
          cart_items: mappedRows,
          preferences,
          orderRecords: nextOrderRecords,
          lastCheckout: recoveredLastCheckout,
        });
      } catch (error) {
        console.error("[useStudentMockStore] syncFromDatabase failed:", error);
      }
    },

    addToDatabaseCart: async (input) => {
      try {
        validateQuantity(input.quantity);
        await CartServices.addToCart(input);
        await get().syncFromDatabase();
        return { ok: true };
      } catch (error) {
        return { ok: false, message: errorMessage(error) };
      }
    },

    updateDatabaseCartQuantity: async (id, quantity) => {
      try {
        validateQuantity(quantity);
        if (!get().serverCart) {
          return get().updateCartItemQuantity(id, quantity);
        }
        await CartServices.updateQuantity(id, quantity);
        await get().syncFromDatabase();
        return { ok: true };
      } catch (error) {
        return { ok: false, message: errorMessage(error) };
      }
    },

    removeDatabaseCartItem: async (id) => {
      try {
        if (!get().serverCart) {
          return get().removeCartItem(id);
        }
        await CartServices.deleteCartItem(id);
        await get().syncFromDatabase();
        return { ok: true };
      } catch (error) {
        return { ok: false, message: errorMessage(error) };
      }
    },

    checkoutDatabaseCart: async () => {
      try {
        const state = get();
        const location = state.location.trim();
        const address = state.address.trim();

        if (!location || !address) {
          throw new Error("Vui lòng nhập đầy đủ địa chỉ nhận hàng.");
        }

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("Vui lòng đăng nhập để đặt hàng.");
        }

        if (!get().serverCart) {
          await get().syncFromDatabase(user.id);
        }

        const currentServerCart = get().serverCart;
        if (!currentServerCart || currentServerCart.items.length === 0) {
          throw new Error("Giỏ hàng của bạn đang trống.");
        }

        const restaurantPreferences = currentServerCart.groups.map((g) => {
          const pref = state.preferences[g.restaurant.id];
          return {
            restaurant_id: g.restaurant.id,
            payment_method: (pref?.payment === "bank"
              ? "bank_transfer"
              : "cash") as "cash" | "bank_transfer",
            customer_notes: pref?.note?.trim() || null,
          };
        });

        const response = await OrderServices.createOrder({
          items: currentServerCart.items.map((item) => ({
            cartItemId: item.id,
            quantity: item.quantity,
            expectedUnitPrice: getCartItemUnitPrice(item),
          })),
          deliveryAddress: `${location}, ${address}`,
          restaurantPreferences,
          expectedTotal: currentServerCart.subtotal,
        });

        await get().syncFromDatabase(user.id);

        const result: CheckoutResult = {
          success: true,
          session_checkout_id: response.sessionCheckoutId,
          orders: response.orders.map((o) => ({
            order_id: o.orderId,
            restaurant_id: o.restaurantId,
            order_code: o.orderCode,
          })),
        };

        set({
          lastCheckout: {
            sessionId: response.sessionCheckoutId,
            location,
            address,
          },
          preferences: {},
        });

        return { ok: true, result };
      } catch (error) {
        return { ok: false, message: errorMessage(error) };
      }
    },

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

    reorderOrder: (orderId) => {
      try {
        const state = get();
        if (!state.hasHydrated)
          throw new Error("Vui lòng chờ khôi phục giỏ hàng.");
        const order = state.orderRecords[orderId];
        if (!order) throw new Error("Không tìm thấy đơn hàng.");
        const rows = prepareReorder(order, {
          customerId: state.cart.student_id,
          cartId: state.cart.id,
          rows: state.cart_items,
          restaurants: mockRestaurants,
          menu: mockMenuItemDetails,
        });
        // Preserve current address/payment/notes for review at checkout.
        commitCart(rows);
        return { ok: true };
      } catch (error) {
        return { ok: false, message: errorMessage(error) };
      }
    },

    updateCartItemQuantity: (id, quantity) => {
      try {
        validateQuantity(quantity);
        const rows = get().cart_items;
        if (!rows.some((row) => row.id === id))
          throw new Error("Không tìm thấy món trong giỏ.");
        commitCart(
          rows.map((row) =>
            row.id === id
              ? { ...row, quantity, updated_at: new Date().toISOString() }
              : row,
          ),
        );
        return { ok: true };
      } catch (error) {
        return { ok: false, message: errorMessage(error) };
      }
    },
    removeCartItem: (id) => {
      try {
        const rows = get().cart_items;
        if (!rows.some((row) => row.id === id))
          throw new Error("Không tìm thấy món trong giỏ.");
        commitCart(rows.filter((row) => row.id !== id));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: errorMessage(error) };
      }
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
          existing_orders: Object.values(state.orderRecords),
        });

        const orderRecords = { ...state.orderRecords };

        for (const order of output.created_orders) {
          orderRecords[order.id] = order;
        }

        // Một lần cập nhật: lưu toàn bộ đơn và xóa giỏ.
        // Nếu simulateCheckout lỗi, chưa đổi state.
        set({
          orderRecords,
          lastCheckout: {
            sessionId: output.result.session_checkout_id,
            location,
            address,
          },
          cart_items: [],
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

function snapshot(state: StudentMockState): StudentSnapshot {
  return {
    version: 1,
    customerId: state.cart.student_id,
    cart: state.cart,
    cart_items: state.cart_items,
    orderRecords: state.orderRecords,
    location: state.location,
    address: state.address,
    preferences: state.preferences,
    lastCheckout: state.lastCheckout,
  };
}

// Called after mount only: the server and first browser render both use empty state.
// Return the unsubscribe function for React StrictMode and layout unmounts.
export function startStudentPersistence(
  storage: Pick<Storage, "getItem" | "setItem">,
) {
  const key = studentStorageKey(MOCK_CUSTOMER.id);
  let writable = true;
  let warning: string | null = null;
  if (!useStudentMockStore.getState().hasHydrated) {
    try {
      const raw = storage.getItem(key);
      if (raw !== null) {
        const saved = parseStudentSnapshot(raw, MOCK_CUSTOMER.id);
        projectCart(saved.cart_items);
        useStudentMockStore.setState({
          cart: saved.cart,
          cart_items: saved.cart_items,
          orderRecords: saved.orderRecords,
          location: saved.location,
          address: saved.address,
          preferences: saved.preferences,
          lastCheckout: saved.lastCheckout,
        });
      }
    } catch {
      // Do not overwrite an unreadable/unsupported snapshot with an empty cart.
      writable = false;
      warning =
        "Không thể khôi phục dữ liệu demo. Bản lưu cũ được giữ nguyên; thay đổi trong phiên này sẽ không được lưu. Hãy kiểm tra quyền lưu trữ hoặc sao lưu/xóa riêng dữ liệu demo rồi tải lại trang.";
    }
    useStudentMockStore.setState({
      hasHydrated: true,
      storageReadFailed: !writable,
      storageWarning: warning,
    });
  } else if (useStudentMockStore.getState().storageReadFailed) {
    writable = false;
  }

  return useStudentMockStore.subscribe((state, previous) => {
    if (
      !writable ||
      state.serverCart !== null ||
      state.cart.student_id !== MOCK_CUSTOMER.id ||
      (state.cart === previous.cart &&
        state.cart_items === previous.cart_items &&
        state.orderRecords === previous.orderRecords &&
        state.location === previous.location &&
        state.address === previous.address &&
        state.preferences === previous.preferences &&
        state.lastCheckout === previous.lastCheckout)
    )
      return;
    try {
      // One write contains both new orders and the emptied cart after checkout.
      storage.setItem(key, JSON.stringify(snapshot(state)));
      if (state.storageWarning)
        useStudentMockStore.setState({ storageWarning: null });
    } catch {
      const message =
        "Không thể lưu dữ liệu demo (bộ nhớ đầy hoặc bị chặn). Dữ liệu hiện tại vẫn dùng được, nhưng thay đổi mới có thể mất khi tải lại trang.";
      if (state.storageWarning !== message)
        useStudentMockStore.setState({ storageWarning: message });
    }
  });
}
