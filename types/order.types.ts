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
  "option_snapshot_price"
> & {
  option_snapshot_price: OptionSnapshot[];
};

export type OrderDetail = Order & {
  order_items: OrderItem[];
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
