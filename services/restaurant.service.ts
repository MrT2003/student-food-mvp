import {
  mockMenuItemDetails,
  mockMenuRouteAliases,
  mockRestaurants,
} from "@/lib/mocks/catalog.mock";

import type { MenuItemDetail, RestaurantMenu } from "@/types/restaurant.types";

import type { StudentService } from "@/types/student-service.types";

type RestaurantService = Pick<
  StudentService,
  "listRestaurants" | "getRestaurantMenu"
> & {
  getMenuItem(
    restaurantSlug: string,
    itemSlugOrId: string,
  ): Promise<MenuItemDetail | null>;
};

function getPublicRestaurant(slug: string) {
  return mockRestaurants.find(
    (restaurant) => restaurant.slug === slug && restaurant.status === "active",
  );
}

function getPublicMenuItems(restaurantId: string): MenuItemDetail[] {
  return mockMenuItemDetails
    .filter((item) => item.restaurant_id === restaurantId && item.is_active)
    .map((item) => ({
      ...item,
      option_groups: item.option_groups
        .filter((group) => group.is_active)
        .map((group) => ({
          ...group,
          options: group.options.filter((option) => option.is_active),
        })),
    }));
}

export const restaurantService: RestaurantService = {
  async listRestaurants() {
    const restaurants = mockRestaurants.filter(
      (restaurant) => restaurant.status === "active",
    );

    // Trả bản sao để bên gọi không sửa trực tiếp fixture dùng chung.
    return structuredClone(restaurants);
  },

  async getRestaurantMenu(slug) {
    const restaurant = getPublicRestaurant(slug);

    if (!restaurant) {
      return null;
    }

    const result: RestaurantMenu = {
      restaurant,
      items: getPublicMenuItems(restaurant.id),
    };

    return structuredClone(result);
  },

  async getMenuItem(restaurantSlug, itemSlugOrId) {
    const restaurant = getPublicRestaurant(restaurantSlug);

    if (!restaurant) {
      return null;
    }

    const items = getPublicMenuItems(restaurant.id);

    // Hỗ trợ UUID hoặc slug mới.
    let item = items.find(
      (entry) => entry.id === itemSlugOrId || entry.slug === itemSlugOrId,
    );

    // Hỗ trợ URL cũ trong thời gian chuyển đổi.
    // Luôn giới hạn alias trong đúng quán.
    if (!item) {
      const alias = mockMenuRouteAliases.find(
        (entry) =>
          entry.restaurant_id === restaurant.id &&
          entry.legacy_slug === itemSlugOrId,
      );

      if (alias) {
        item = items.find((entry) => entry.id === alias.menu_item_id);
      }
    }

    return item ? structuredClone(item) : null;
  },
};
