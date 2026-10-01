import type { AddCartItemInput, CartViewData } from "@/types/cart.types";
import type {
  CheckoutResult,
  CreateCheckoutInput,
  OrderDetailView,
} from "@/types/order.types";
import type {
  RestaurantMenu,
  RestaurantPublic,
} from "@/types/restaurant.types";

export interface StudentService {
  listRestaurants(): Promise<RestaurantPublic[]>;

  getRestaurantMenu(slug: string): Promise<RestaurantMenu | null>;

  getCart(): Promise<CartViewData>;

  addCartItem(input: AddCartItemInput): Promise<CartViewData>;

  updateCartItemQuantity(
    cartItemId: string,
    quantity: number,
  ): Promise<CartViewData>;

  removeCartItem(cartItemId: string): Promise<CartViewData>;

  checkout(input: CreateCheckoutInput): Promise<CheckoutResult>;

  listOrders(): Promise<OrderDetailView[]>;

  getOrder(orderId: string): Promise<OrderDetailView | null>;

  cancelOrder(orderId: string): Promise<OrderDetailView>;
}
