// import CartTestPanel from "@/components/buttons/addToCartBtn";
// import OrderTestPanel from "@/components/buttons/orderTestPanel";
import HomeView from "@/components/features/home/HomeView";
// import HomeView from "@/components/features/home/HomeView";
import { toHomeRestaurants } from "@/lib/restaurant/view-model";
import { RestaurantService } from "@/services/restaurant.service";
import { catalogTimer } from "@/lib/restaurant/timing";
import type { Metadata } from "next";
import { RestaurantCatalog, RestaurantMenu } from "@/types/restaurant.types";
export const metadata: Metadata = {
  title: "Trang chủ | StudentFood",
  description: "Khám phá các quán ăn quanh khu ký túc xá.",
};

export default async function HomePage() {
  // Catalog gọn dùng chung cho danh sách; không fetch menu/options riêng cho từng quán.
  const menus : RestaurantCatalog[] = await RestaurantService.getCatalog();
  const mappingDone = catalogTimer("home.view-model");
  // Map dữ liệu rồi trả component để thay thế skeleton sau khi tải xong.
  const restaurants = toHomeRestaurants(menus);
  mappingDone({ restaurants: restaurants.length });
  return <HomeView initialRestaurants={restaurants} />;
}
