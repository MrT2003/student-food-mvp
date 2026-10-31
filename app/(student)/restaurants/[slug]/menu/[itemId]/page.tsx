import { notFound } from "next/navigation";
import DishView from "@/components/features/dish/DishView";
import { RestaurantService } from "@/services/restaurant.service";
import {
  mockMenuItemDetails,
  mockMenuRouteAliases,
  mockRestaurants,
} from "@/lib/mocks/catalog.mock";
import type { MenuItemDetail, RestaurantPublic } from "@/types/restaurant.types";

type Props = {
  params: Promise<{
    slug: string;
    itemId: string;
  }>;
};

function findFallbackDish(
  slug: string,
  itemId: string,
): { restaurant: RestaurantPublic; item: MenuItemDetail } | null {
  const restaurant = mockRestaurants.find(
    (entry) => entry.slug === slug && entry.status === "active",
  );
  if (!restaurant) return null;

  const restaurantItems = mockMenuItemDetails.filter(
    (entry) => entry.restaurant_id === restaurant.id && entry.is_active,
  );

  let item = restaurantItems.find(
    (entry) =>
      entry.id === itemId ||
      entry.slug === itemId ||
      entry.slug === `${slug}-${itemId}`,
  );

  if (!item) {
    const alias = mockMenuRouteAliases.find(
      (entry) =>
        entry.restaurant_id === restaurant.id && entry.legacy_slug === itemId,
    );
    if (alias) {
      item = restaurantItems.find((entry) => entry.id === alias.menu_item_id);
    }
  }

  return item ? { restaurant, item } : null;
}

export default async function DishPage({ params }: Props) {
  const { slug, itemId } = await params;

  let restaurant: RestaurantPublic | null = null;
  let item: MenuItemDetail | null = null;

  try {
    const [menu, directItem] = await Promise.all([
      RestaurantService.getRestaurantMenu(slug),
      RestaurantService.getMenuItem(slug, itemId),
    ]);

    if (menu) {
      restaurant = menu.restaurant;
      item =
        directItem ??
        menu.items.find(
          (entry) =>
            entry.id === itemId ||
            entry.slug === itemId ||
            entry.slug === `${slug}-${itemId}`,
        ) ??
        null;
    }
  } catch {
    // Fallback sang dữ liệu catalog mẫu khi môi trường local chưa kết nối DB.
  }

  if (!restaurant || !item) {
    const fallback = findFallbackDish(slug, itemId);
    if (fallback) {
      restaurant = fallback.restaurant;
      item = fallback.item;
    }
  }

  if (!restaurant || !item) notFound();

  if (item.restaurant_id !== restaurant.id) {
    notFound();
  }

  return (
    <DishView
      key={`${restaurant.id}/${item.id}`}
      restaurant={restaurant}
      item={item}
    />
  );
}
