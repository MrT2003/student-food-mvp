import type { CatalogItem, RestaurantCatalog, MenuItemDetail, RestaurantMenu } from "@/types/restaurant.types";
import type { PreviewRestaurant } from "@/lib/home/mock-data";
import type { ExploreRestaurant, FoodKind } from "@/lib/explore/mock-data";
import { dishHref, type PopularDishCard } from "@/lib/explore/popular-data";
import { getDishKind, type HomeIllustration } from "@/lib/mocks/catalog-views.mock";
import {
  MASTER_CATEGORIES,
  normalizeMasterCategory,
  type MasterCategory,
} from "@/lib/categories";

export const menuCategories = MASTER_CATEGORIES;

export type MenuCategory = MasterCategory;

export type MenuItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: MenuCategory;
  available: boolean;
  hasOptions: boolean;
};

export type RestaurantDetail = {
  id: string;
  slug: string;
  name: string;
  location: string;
  description: string;
  avatar_url: string | null;
  hours: string | null;
  isOpen: boolean;
  payments: string[];
  menu: MenuItem[];
};

function toCategory(value: string | null, itemName?: string): MenuCategory {
  return normalizeMasterCategory(value, itemName);
}

function inferVisuals(
  name: string,
  categories: string[],
): { kind: FoodKind; illustration: HomeIllustration } {
  const joined = [name, ...categories].join(" ").toLowerCase();
  if (/trà sữa|nước uống|đồ uống|trà|cafe|coffee/.test(joined)) {
    return { kind: "tea", illustration: "tea" };
  }
  if (/bánh mì|ăn nhẹ/.test(joined)) {
    return { kind: "bread", illustration: "bread" };
  }
  if (/món hàn|mì cay|seoul|kim chi/.test(joined)) {
    return { kind: "noodles", illustration: "spicy" };
  }
  if (/bún|phở|mì|hủ tiếu|món việt/.test(joined)) {
    return { kind: "noodles", illustration: "noodles" };
  }
  if (/ăn vặt|gà rán|xiên|đồ chiên/.test(joined)) {
    return { kind: "snack", illustration: "chicken" };
  }
  return { kind: "rice", illustration: "rice" };
}

function deriveCategories(items: CatalogItem[], restaurantName: string): MasterCategory[] {
  const normalizedFromItems = [
    ...new Set(
      items
        .filter((item) => item.is_active)
        .map((item) => normalizeMasterCategory(item.category, item.name)),
    ),
  ];

  if (normalizedFromItems.length > 0) {
    return normalizedFromItems;
  }

  // Chỉ suy luận từ tên quán khi quán chưa có món nào active, không gán cứng ["Cơm", "Món Việt"].
  return [normalizeMasterCategory(null, restaurantName)];
}

export function toHomeRestaurants(menus: RestaurantCatalog[]): PreviewRestaurant[] {
  return menus.map(({ restaurant, items }) => {
    const activeItems = items.filter((item) => item.is_active);
    const categories = deriveCategories(activeItems, restaurant.name);
    const { illustration } = inferVisuals(restaurant.name, categories);

    return {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      description: restaurant.description,
      avatar_url: restaurant.avatar_url,
      location: restaurant.location,
      operating_status: restaurant.operating_status,
      menuItemCount: activeItems.length,
      categories,
      illustration,
      searchTerms: activeItems.map((item) => item.name),
      orderCount: 0,
    };
  });
}

export function toExploreRestaurants(menus: RestaurantCatalog[]): ExploreRestaurant[] {
  return menus.map(({ restaurant, items }, index) => {
    const activeItems = items.filter((item) => item.is_active);
    const categories = deriveCategories(activeItems, restaurant.name);
    const { kind } = inferVisuals(restaurant.name, categories);

    return {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      location: restaurant.location ?? "",
      menuCount: activeItems.length,
      categories,
      isOpen:
        restaurant.status === "active" && restaurant.operating_status === "open",
      popularity: Math.max(10, 100 - index * 5),
      kind,
      imageUrl: restaurant.avatar_url,
      searchTerms: activeItems.map((item) => item.name),
    };
  });
}

export function toPopularDishCards(menus: RestaurantCatalog[]): PopularDishCard[] {
  let rank = 0;
  return menus.flatMap(({ restaurant, items }) => {
    const activeItems = items.filter((item) => item.is_active && item.is_available);
    const restaurantCategories = deriveCategories(activeItems, restaurant.name);
    const { kind: fallbackKind } = inferVisuals(
      restaurant.name,
      restaurantCategories,
    );

    return activeItems.map((item) => {
      const itemCategory = normalizeMasterCategory(item.category, item.name);
      const categories = [
        ...new Set([itemCategory, ...restaurantCategories]),
      ];
      return {
        id: item.id,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        name: item.name,
        price: item.price,
        kind: getDishKind(itemCategory, fallbackKind),
        imageUrl: item.image_url,
        categories,
        rank: rank++,
        href: dishHref(restaurant.slug, item.slug || item.id),
      };
    });
  });
}

export function toMenuItemView(item: MenuItemDetail): MenuItem {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description ?? "",
    price: item.price,
    image_url: item.image_url,
    category: toCategory(item.category, item.name),
    available: item.is_active && item.is_available,
    hasOptions: item.option_groups.some(
      (group) =>
        group.is_active && group.options.some((option) => option.is_active),
    ),
  };
}

export function toRestaurantView(data: RestaurantMenu): RestaurantDetail {
  const { restaurant, items } = data;

  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    location: restaurant.location ?? "",
    description: restaurant.description ?? "",
    avatar_url: restaurant.avatar_url,
    isOpen:
      restaurant.status === "active" && restaurant.operating_status === "open",

    // Chưa có dữ liệu để hiển thị, không tự giả định.
    hours: null,
    payments: [],

    menu: items.filter((item) => item.is_active).map(toMenuItemView),
  };
}
