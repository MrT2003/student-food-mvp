import {
  exploreRestaurants,
  popularDishes,
  type FoodKind,
} from "@/lib/explore/mock-data";
import { getRestaurantDetail } from "@/lib/restaurant/mock-data";

export type PopularDishCard = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  name: string;
  price: number;
  kind: FoodKind;
  categories: string[];
  rank: number;
  href: string;
};

export function dishHref(restaurantId: string, itemId: string) {
  return `/restaurants/${encodeURIComponent(restaurantId)}/menu/${encodeURIComponent(itemId)}`;
}

export const popularDishCards: PopularDishCard[] = popularDishes.flatMap(
  (dish, index) => {
    const restaurant = getRestaurantDetail(dish.restaurantId);
    const item = restaurant?.menu.find((entry) => entry.id === dish.id);
    const source = exploreRestaurants.find(
      (entry) => entry.id === dish.restaurantId,
    );

    if (!restaurant || !item || !source) return [];

    return [
      {
        id: item.id,
        restaurantId: restaurant.slug,
        restaurantName: restaurant.name,
        name: item.name,
        price: item.price,
        kind: dish.kind,
        categories: source.categories,
        // Thứ tự demo, chưa phải thống kê số đơn thực tế hôm nay.
        rank: index,
        href: dishHref(restaurant.slug, item.id),
      },
    ];
  },
);
