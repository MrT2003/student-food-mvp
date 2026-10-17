import type { Metadata } from "next";
import ExploreView from "@/components/features/explore/ExploreView";
import {
  toExploreRestaurants,
  toPopularDishCards,
} from "@/lib/restaurant/view-model";
import { RestaurantService } from "@/services/restaurant.service";
import type { RestaurantMenu } from "@/types/restaurant.types";

export const metadata: Metadata = {
  title: "Khám phá | StudentFood",
  description: "Khám phá các quán ăn và món ngon quanh khu ký túc xá.",
};

export default async function ExplorePage() {
  const list = await RestaurantService.listRestaurants();
  const menus = (
    await Promise.all(
      list.map((restaurant) => RestaurantService.getRestaurantMenu(restaurant.slug)),
    )
  ).filter((entry): entry is RestaurantMenu => entry !== null);

  return (
    <ExploreView
      initialRestaurants={toExploreRestaurants(menus)}
      initialPopularDishes={toPopularDishCards(menus)}
    />
  );
}