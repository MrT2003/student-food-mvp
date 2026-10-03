import type { Cart, CartItem } from "@/types/cart.types";
import type {
  CheckoutResult,
  CreateCheckoutInput,
  OrderDetail,
  OrderItem,
} from "@/types/order.types";
import type {
  MenuItemDetail,
  RestaurantPublic,
} from "@/types/restaurant.types";
import { resolveSelectedOptions } from "@/lib/cart/options";

type MockCheckoutContext = {
  customer: {
    id: string;
    role: "student" | "staff" | "seller";
    status: string;
  };
  cart: Cart;
  cart_items: CartItem[];
  restaurants: RestaurantPublic[];
  menu_items: MenuItemDetail[];
};

export type MockCheckoutOutput = {
  result: CheckoutResult;
  created_orders: OrderDetail[];
};

// Chỉ tạo kết quả mock, không gọi API và không tự thay đổi store.
// Store sẽ lưu tất cả đơn và xóa giỏ trong cùng một lần cập nhật
// sau khi hàm này chạy thành công.
export function simulateCheckout(
  input: CreateCheckoutInput,
  context: MockCheckoutContext,
): MockCheckoutOutput {
  const { customer, cart, cart_items, restaurants, menu_items } = context;

  if (
    customer.status !== "active" ||
    !["student", "staff"].includes(customer.role)
  ) {
    throw new Error("Tài khoản không có quyền đặt hàng.");
  }

  if (cart.student_id !== customer.id) {
    throw new Error("Giỏ hàng không thuộc tài khoản hiện tại.");
  }

  if (cart_items.length === 0) {
    throw new Error("Giỏ hàng đang trống.");
  }

  if (!input.p_delivery_address.trim()) {
    throw new Error("Vui lòng nhập địa chỉ nhận hàng.");
  }

  const restaurantIds = new Set(cart_items.map((item) => item.restaurant_id));

  const preferences = new Map(
    input.p_restaurant_preferences.map((preference) => [
      preference.restaurant_id,
      preference,
    ]),
  );

  if (
    preferences.size !== input.p_restaurant_preferences.length ||
    preferences.size !== restaurantIds.size ||
    [...preferences.keys()].some((id) => !restaurantIds.has(id))
  ) {
    throw new Error("Lựa chọn thanh toán không khớp các quán trong giỏ.");
  }

  const sessionId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const createdOrders: OrderDetail[] = [];

  for (const restaurantId of restaurantIds) {
    const restaurant = restaurants.find((item) => item.id === restaurantId);

    if (
      !restaurant ||
      restaurant.status !== "active" ||
      restaurant.operating_status !== "open"
    ) {
      throw new Error("Có cửa hàng hiện không nhận đơn.");
    }

    const preference = preferences.get(restaurantId);

    if (
      !preference ||
      !["cash", "bank_transfer"].includes(preference.payment_method)
    ) {
      throw new Error("Vui lòng chọn thanh toán cho từng cửa hàng.");
    }

    const orderId = crypto.randomUUID();

    const orderItems: OrderItem[] = cart_items
      .filter((item) => item.restaurant_id === restaurantId)
      .map((item) => {
        if (
          item.cart_id !== cart.id ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1
        ) {
          throw new Error("Dòng giỏ hàng không hợp lệ.");
        }

        const menuItem = menu_items.find(
          (menu) =>
            menu.id === item.menu_item_id &&
            menu.restaurant_id === restaurantId,
        );

        if (!menuItem?.is_active || !menuItem.is_available) {
          throw new Error("Có món đã ngừng bán hoặc không còn khả dụng.");
        }

        if (!Number.isFinite(menuItem.price) || menuItem.price < 0) {
          throw new Error("Giá món không hợp lệ.");
        }

        const snapshots = resolveSelectedOptions(
          menuItem,
          item.selected_options,
        );

        const unitPrice =
          menuItem.price +
          snapshots.reduce((sum, option) => sum + option.additional_price, 0);

        return {
          id: crypto.randomUUID(),
          order_id: orderId,
          menu_item_id: menuItem.id,
          item_name_snapshot: menuItem.name,
          image_url: menuItem.image_url,
          quantity: item.quantity,
          unit_price_snapshot: unitPrice,
          option_snapshot_price: snapshots,
        };
      });

    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.unit_price_snapshot * item.quantity,
      0,
    );

    createdOrders.push({
      id: orderId,
      session_checkout_id: sessionId,

      // Mã demo, không phải quy tắc cấp mã của backend.
      order_code: `DEMO-${orderId}`,

      student_id: customer.id,
      restaurant_id: restaurantId,
      order_status: "pending",
      payment_method: preference.payment_method,
      payment_confirmed_by: null,
      payment_confirmed_at: null,
      subtotal,
      total: subtotal,
      delivery_address: input.p_delivery_address.trim(),
      customer_notes: preference.customer_notes?.trim() || null,
      created_at: createdAt,
      accepted_at: null,
      completed_at: null,
      order_items: orderItems,
    });
  }

  return {
    result: {
      success: true,
      session_checkout_id: sessionId,
      orders: createdOrders.map((order) => ({
        order_id: order.id,
        restaurant_id: order.restaurant_id,
        order_code: order.order_code,
      })),
    },
    created_orders: createdOrders,
  };
}
