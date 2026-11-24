import type { Metadata } from "next";
import PopularDishesView from "@/components/features/explore/PopularDishesView";
import { toPopularDishCards } from "@/lib/restaurant/view-model";
import { RestaurantService } from "@/services/restaurant.service";
import { catalogTimer } from "@/lib/restaurant/timing";

export const metadata: Metadata = {
  title: "Món phổ biến hôm nay | StudentFood",
  description: "Khám phá các món ăn phổ biến trên StudentFood.",
};

export default async function PopularDishesPage() {
  // Catalog gọn dùng chung cho danh sách; không fetch menu/options riêng cho từng quán.
  const menus = await RestaurantService.getCatalog();
  const mappingDone = catalogTimer("popular.view-model");
  // Trả dữ liệu đã map cho UI; không phát sinh truy vấn mới.
  const dishes = toPopularDishCards(menus);
  mappingDone({ dishes: dishes.length });
  return <PopularDishesView dishes={dishes} />;
}

