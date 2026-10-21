"use client";

import DishView, { type DishViewProps } from "@/components/features/dish/DishView";
import { previewDrinkItem, previewDrinkRestaurant } from "@/lib/dish/options";

export default function DrinkCustomizationView(
  props: Omit<DishViewProps, "mode">,
) {
  return (
    <DishView
      restaurant={props.restaurant ?? previewDrinkRestaurant}
      item={props.item ?? previewDrinkItem}
      mode="drink"
      defaultSelectedOptionIds={props.defaultSelectedOptionIds}
      defaultQuantity={props.defaultQuantity}
    />
  );
}
