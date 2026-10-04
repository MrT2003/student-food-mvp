import type { Database } from "@/types/database.types";

type RestaurantRow =
  Database["public"]["Tables"]["restaurants"]["Row"];

export type RestaurantSummary = Pick<
  RestaurantRow,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "avatar_url"
  | "location"
  | "operating_status"
>;

export type HomeRestaurant = RestaurantSummary & {
  menuItemCount: number | null;
  categories: string[];
};

export type HomeFilters = {
  query: string;
  openOnly: boolean;
  location: "all" | "KTX A" | "KTX B";
  category: "all" | "Cơm" | "Trà sữa" | "Ăn vặt";
};

export type ReorderRestaurant = {
  restaurant: RestaurantSummary;
  completedOrderCount: number;
};