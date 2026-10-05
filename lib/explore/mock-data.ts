import {
  catalogRestaurantViews,
  popularMenuSlugs,
  getDishKind,
  type FoodKind,
} from "@/lib/mocks/catalog-views.mock";

export type { FoodKind } from "@/lib/mocks/catalog-views.mock";

export type ExploreRestaurant = {
  id: string;
  slug: string;
  name: string;
  location: string;
  menuCount: number;
  categories: string[];
  isOpen: boolean;
  popularity: number;
  kind: FoodKind;
  searchTerms: string[];
};

export type ExploreDish = {
  id: string;
  slug: string;
  name: string;
  price: number;
  restaurantId: string;
  restaurantSlug: string;
  kind: FoodKind;
};

export const exploreRestaurants: ExploreRestaurant[] =
  catalogRestaurantViews.map((view) => ({
    id: view.restaurant.id,
    slug: view.restaurant.slug,
    name: view.restaurant.name,
    location: view.restaurant.location ?? "",
    menuCount: view.items.length,
    categories: [...view.categories],
    isOpen: view.restaurant.operating_status === "open",
    popularity: view.popularity,
    kind: view.kind,
    searchTerms: [...view.searchTerms],
  }));

const catalogDishes: ExploreDish[] = catalogRestaurantViews.flatMap((view) =>
  view.items
    .filter((item) => item.is_available)
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      price: item.price,
      restaurantId: view.restaurant.id,
      restaurantSlug: view.restaurant.slug,
      kind: getDishKind(item.category, view.kind),
    })),
);

// Giữ thứ tự demo, nhưng tên/giá/ID đều lấy từ catalog.
export const popularDishes: ExploreDish[] = popularMenuSlugs.flatMap((slug) => {
  const item = catalogDishes.find((entry) => entry.slug === slug);

  return item ? [item] : [];
});
