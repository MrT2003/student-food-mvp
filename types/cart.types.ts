import type { Database } from "@/types/database.types";
import type { CartItem as DisplayCartItem, CartRestaurant } from "@/lib/cart/view-model";
import type { getCartSummary } from "@/lib/cart/calculations";
import type {
  MenuItemDetail,
  RestaurantPublic,
} from "@/types/restaurant.types";

type Tables = Database["public"]["Tables"];

export type Cart = Tables["carts"]["Row"];

// Kết quả đọc giỏ thật: giữ nguyên tên field mà CartView/OrderConfirmView sử dụng.
// cart = null nghĩa là người dùng chưa tạo giỏ, không cần INSERT khi chỉ xem giỏ.
export type GetCartResult = ReturnType<typeof getCartSummary> & {
  cart: Cart | null;
  items: DisplayCartItem[];
  restaurants: CartRestaurant[];
};

// Quy ước JSON gửi trong selected_options.
// Không chứa giá do khách hàng quyết định.
export type SelectedOption = {
  option_id: string;
};

export type CartItem = Omit<Tables["cart_items"]["Row"], "selected_options"> & {
  selected_options: SelectedOption[];
};

export type AddCartItemInput = Pick<
  CartItem,
  "menu_item_id" | "restaurant_id" | "quantity" | "selected_options"
>;

// Payload lưu vào bảng cart_items.
// cart_id và option_hash được bổ sung ở lớp service.
export type AddCartItemPayload = AddCartItemInput & {
  cart_id: string;
  option_hash: string;
};

// Thông tin hiển thị được ghép từ menu và quán.
// Không ghi menu_item hoặc restaurant vào bảng cart_items.
export type CartLineView = {
  item: CartItem;
  menu_item: MenuItemDetail;
  restaurant: RestaurantPublic;
  estimated_unit_price: number;
  estimated_total: number;
};

export type CartViewData = {
  cart: Cart;
  lines: CartLineView[];
};
