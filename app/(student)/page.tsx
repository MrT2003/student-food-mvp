// import CartTestPanel from "@/components/buttons/addToCartBtn";
// import OrderTestPanel from "@/components/buttons/orderTestPanel";
import HomeView from "@/components/features/home/HomeView";
// import HomeView from "@/components/features/home/HomeView";
import { toHomeRestaurants } from "@/lib/restaurant/view-model";
import { RestaurantService } from "@/services/restaurant.service";
import type { RestaurantMenu } from "@/types/restaurant.types";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Trang chủ | StudentFood",
  description: "Khám phá các quán ăn quanh khu ký túc xá.",
};

export default async function HomePage() {
  const list = await RestaurantService.listRestaurants();
  const menus = (
    await Promise.all(
      list.map((restaurant) => RestaurantService.getRestaurantMenu(restaurant.slug)),
    )
  ).filter((entry): entry is RestaurantMenu => entry !== null);

  return <HomeView initialRestaurants={toHomeRestaurants(menus)} />;
}

