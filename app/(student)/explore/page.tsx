import type { Metadata } from "next";
import ExploreView from "@/components/features/explore/ExploreView";
import {
  toExploreRestaurants,
  toPopularDishCards,
} from "@/lib/restaurant/view-model";
import { RestaurantService } from "@/services/restaurant.service";
import { catalogTimer } from "@/lib/restaurant/timing";

export const metadata: Metadata = {
  title: "Khám phá | StudentFood",
  description: "Khám phá các quán ăn và món ngon quanh khu ký túc xá.",
};

export default async function ExplorePage() {
  // Catalog gọn dùng chung cho danh sách; không fetch menu/options riêng cho từng quán.
  const menus = await RestaurantService.getCatalog();
  const mappingDone = catalogTimer("explore.view-model");
  // Dùng cùng catalog cho cả hai danh sách, không phát sinh truy vấn mới.
  const restaurants = toExploreRestaurants(menus);
  const dishes = toPopularDishCards(menus);
  mappingDone({ restaurants: restaurants.length, dishes: dishes.length });
  return <ExploreView initialRestaurants={restaurants} initialPopularDishes={dishes} />;
}
