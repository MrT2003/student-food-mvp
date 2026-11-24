"use client";

import DishView, { type DishViewProps } from "@/components/features/dish/DishView";
import { previewFoodItem, previewFoodRestaurant } from "@/lib/dish/options";

export default function FoodCustomizationView(
  props: Omit<DishViewProps, "mode">,
) {
  return (
    <DishView
      restaurant={props.restaurant ?? previewFoodRestaurant}
      item={props.item ?? previewFoodItem}
      mode="food"
      defaultSelectedOptionIds={props.defaultSelectedOptionIds}
      defaultQuantity={props.defaultQuantity}
    />
  );
}
