import type { Metadata } from "next";
import PopularDishesView from "@/components/features/explore/PopularDishesView";
import { toPopularDishCards } from "@/lib/restaurant/view-model";
import { RestaurantService } from "@/services/restaurant.service";
import type { RestaurantMenu } from "@/types/restaurant.types";

export const metadata: Metadata = {
  title: "Món phổ biến hôm nay | StudentFood",
  description: "Khám phá các món ăn phổ biến trên StudentFood.",
};

export default async function PopularDishesPage() {
  const list = await RestaurantService.listRestaurants();
  const menus = (
    await Promise.all(
      list.map((restaurant) => RestaurantService.getRestaurantMenu(restaurant.slug)),
    )
  ).filter((entry): entry is RestaurantMenu => entry !== null);

  return <PopularDishesView dishes={toPopularDishCards(menus)} />;
}
