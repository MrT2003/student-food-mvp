import { createDebouncedSync } from "@/lib/cart/debounced-sync";
import { cartService } from "@/services/cart.service";
import type { CartSyncInput } from "@/services/cart.service";

// Shared across routes: unmounting CartView does not discard pending changes.
export const cartSync = createDebouncedSync<CartSyncInput>(
  (snapshot) => cartService.syncCart(snapshot),
  700,
);
