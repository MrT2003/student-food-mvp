"use client";

import { useMemo } from "react";
import { useCartStore } from "@/store/useCartStore";
import { getCartSummary } from "@/lib/cart/calculations";
import { projectCart } from "@/lib/cart/view-model";

export function useCartSummary() {
  const rows = useCartStore((state) => state.cart_items);

  return useMemo(
    () => {
      const { items, restaurants } = projectCart(rows);
      return { items, ...getCartSummary(items, restaurants) };
    },
    [rows],
  );
}
