"use client";

import { useMemo } from "react";
import { useCartStore } from "@/store/useCartStore";
import { getCartSummary } from "@/lib/cart/calculations";

export function useCartSummary() {
  const items = useCartStore((state) => state.items);
  const restaurants = useCartStore((state) => state.restaurants);

  return useMemo(
    () => getCartSummary(items, restaurants),
    [items, restaurants],
  );
}
