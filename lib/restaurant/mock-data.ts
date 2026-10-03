import { mockRestaurants, mockMenuItemDetails } from "@/lib/mocks/catalog.mock";

import {
  toRestaurantView,
  type RestaurantDetail,
} from "@/lib/restaurant/view-model";

export {
  menuCategories,
  type MenuCategory,
  type MenuItem,
  type RestaurantDetail,
} from "@/lib/restaurant/view-model";

// Giữ tương thích nếu còn nơi import hàm cũ.
// Các page mới tiếp tục dùng restaurantService.
export function getRestaurantDetail(
  slug: string,
): RestaurantDetail | undefined {
  const restaurant = mockRestaurants.find(
    (entry) => entry.slug === slug && entry.status === "active",
  );

  if (!restaurant) return undefined;

  return toRestaurantView({
    restaurant,
    items: mockMenuItemDetails.filter(
      (item) => item.restaurant_id === restaurant.id && item.is_active,
    ),
  });
}
