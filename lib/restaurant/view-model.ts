import type { MenuItemDetail, RestaurantMenu } from "@/types/restaurant.types";

export const menuCategories = [
  "Cơm",
  "Món chính",
  "Món thêm",
  "Nước uống",
  "Ăn vặt",
] as const;

export type MenuCategory = (typeof menuCategories)[number];

export type MenuItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
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
  hours: string | null;
  isOpen: boolean;
  payments: string[];
  menu: MenuItem[];
};

function toCategory(value: string | null): MenuCategory {
  return menuCategories.find((category) => category === value) ?? "Món chính";
}

export function toMenuItemView(item: MenuItemDetail): MenuItem {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description ?? "",
    price: item.price,
    category: toCategory(item.category),
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
    isOpen:
      restaurant.status === "active" && restaurant.operating_status === "open",

    // Chưa có dữ liệu để hiển thị, không tự giả định.
    hours: null,
    payments: [],

    menu: items.filter((item) => item.is_active).map(toMenuItemView),
  };
}
