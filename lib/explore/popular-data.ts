import {
  exploreRestaurants,
  popularDishes,
  type FoodKind,
} from "@/lib/explore/mock-data";

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

export function dishHref(restaurantSlug: string, itemSlug: string) {
  return (
    `/restaurants/${encodeURIComponent(restaurantSlug)}` +
    `/menu/${encodeURIComponent(itemSlug)}`
  );
}

export const popularDishCards: PopularDishCard[] = popularDishes.flatMap(
  (dish, index) => {
    const restaurant = exploreRestaurants.find(
      (entry) => entry.id === dish.restaurantId,
    );

    if (!restaurant) return [];

    return [
      {
        id: dish.id,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        name: dish.name,
        price: dish.price,
        kind: dish.kind,
        categories: [...restaurant.categories],

        // Thứ tự demo, không phải thống kê đơn hôm nay.
        rank: index,

        href: dishHref(restaurant.slug, dish.slug),
      },
    ];
  },
);
