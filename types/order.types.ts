import type { Database } from "@/types/database.types";
import type { RestaurantPublic } from "@/types/restaurant.types";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type OrderStatus = Enums["order_status"];
export type PaymentMethod = Enums["payment_method_type"];

export type Order = Tables["orders"]["Row"];

export type OptionSnapshot = {
  option_id: string;
  group_name: string;
  option_name: string;
  additional_price: number;
};

export type OrderItem = Omit<
  Tables["order_items"]["Row"],
  "selected_options"
> & {
  selected_options: OptionSnapshot[];
};

export type OrderDetail = Order & {
  order_items: OrderItem[];
  restaurant?: {
    id?: string;
    name: string;
    location: string | null;
  } | null;
};

// Quán có thể không còn public/active khi xem đơn cũ.
// Không vì thiếu thông tin quán mà làm mất đơn hàng.
export type OrderDetailView = OrderDetail & {
  restaurant: RestaurantPublic | null;
};

export type RestaurantCheckoutPreference = {
  restaurant_id: string;
  payment_method: PaymentMethod;
  customer_notes: string | null;
};

// Hợp đồng checkout mới đã thống nhất.
// Team backend cần cập nhật RPC tương ứng;
// không phải chữ ký RPC v1.2 cũ.
export type CreateCheckoutInput = {
  p_delivery_address: string;
  p_restaurant_preferences: RestaurantCheckoutPreference[];
};

export type CheckoutOrderReference = {
  order_id: string;
  restaurant_id: string;
  order_code: string;
};

export type CheckoutResult = {
  success: true;
  session_checkout_id: string;
  orders: CheckoutOrderReference[];
};

export interface CheckoutItemInput {
  cartItemId: string;
  quantity: number;
  expectedUnitPrice: number;
}

// Required input to create order
// 1 order can contains multiple items
export interface CreateOrderInput {
  items: CheckoutItemInput[];
  deliveryAddress: string;
  restaurantPreferences?: RestaurantCheckoutPreference[];
  customerNotes?: string;
  paymentMethod?: PaymentMethod;
  expectedTotal: number;
  sessionCheckoutId?: string;
}

export interface CreateOrderSummary {
  orderId: string;
  orderCode: string;
  restaurantId: string;
  subtotal: string;
  total: string;
}

export interface CreateOrderResponse {
  sessionCheckoutId: string;
  orders: CreateOrderSummary[];
}

// Mỗi phần tử là một dòng món từng đặt; không gộp theo menu_item_id hoặc options.
export type OrderedSummary = {
  orderItemId: string;
  orderId: Order["id"];
  orderCode: Order["order_code"];
  restaurantId: Order["restaurant_id"];
  restaurantName: string | null;
  menuItemId: string | null;
  name: string;
  imageUrl: string | null;
  quantity: number;
  basePriceSnapshot: number;
  // Giá một phần đã gồm options; null nghĩa là snapshot cũ chưa có total_price.
  unitPriceSnapshot: number | null;
  lineTotalSnapshot: number | null;
  restaurantAvailability: "available" | "closed" | "unavailable";
  menuAvailability: "available" | "paused" | "unavailable";
  // UI làm mờ nhưng vẫn cho click; không dùng isDimmed để disabled thẻ.
  isDimmed: boolean;
  notices: string[];
  orderStatus: Order["order_status"];
  createdAt: Order["created_at"];
};
