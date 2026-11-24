import type { Metadata } from "next";
import OpenRestaurantsView from "@/components/features/home/OpenRestaurantsView";
import { toExploreRestaurants } from "@/lib/restaurant/view-model";
import { RestaurantService } from "@/services/restaurant.service";
import type { RestaurantMenu } from "@/types/restaurant.types";

export const metadata: Metadata = {
  title: "Quán đang mở | StudentFood",
  description: "Khám phá tất cả cửa hàng đang hoạt động quanh khu ký túc xá.",
};

export default async function OpenRestaurantsPage() {
  const restaurants = await RestaurantService.listRestaurants();
  const menus = (await Promise.all(
    restaurants
      .filter((restaurant) => restaurant.status === "active" && restaurant.operating_status === "open")
      .map((restaurant) => RestaurantService.getRestaurantMenu(restaurant.slug)),
  )).filter((menu): menu is RestaurantMenu => menu !== null);

  return <OpenRestaurantsView initialRestaurants={toExploreRestaurants(menus)} />;
}
