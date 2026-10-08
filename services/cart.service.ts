import type { CartItem } from "@/types/cart.types";

export type CartSyncInput = {
  cart_id: string;
  items: Pick<CartItem, "id" | "menu_item_id" | "restaurant_id" | "quantity" | "selected_options">[];
};

export const cartService = {
  async syncCart(snapshot: CartSyncInput): Promise<void> {
    // Frontend-only adapter: intentionally no HTTP request yet.
    // Backend integration replaces this method with one atomic full-cart sync.
    // Send absolute quantities, reconcile removed rows, and calculate prices server-side.
    // The server must authenticate the cart owner; client IDs are not authorization.
    void snapshot;
  },
};
