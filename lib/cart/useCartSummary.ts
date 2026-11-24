"use client";

import { useMemo } from "react";
import { useCartStore } from "@/store/useCartStore";
import { getCartSummary } from "@/lib/cart/calculations";
import { projectCart } from "@/lib/cart/view-model";

export function useCartSummary() {
  const serverCart = useCartStore((state) => state.serverCart);
  const rows = useCartStore((state) => state.cart_items);

  return useMemo(() => {
    if (serverCart) {
      return {
        items: serverCart.items,
        groups: serverCart.groups,
        quantity: serverCart.quantity,
        subtotal: serverCart.subtotal,
        unknownRestaurantIds: [] as string[],
      };
    }

    const { items, restaurants } = projectCart(rows);
    return { items, ...getCartSummary(items, restaurants) };
  }, [serverCart, rows]);
}
