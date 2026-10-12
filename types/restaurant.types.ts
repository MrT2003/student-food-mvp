import type { Database } from "@/types/database.types";

type Tables = Database["public"]["Tables"];

export type RestaurantPublic = Pick<
  Tables["restaurants"]["Row"],
  | "id"
  | "name"
  | "slug"
  | "description"
  | "location"
  | "avatar_url"
  | "status"
  | "operating_status"
  | "operating_hours"
>;

export type MenuItem = Tables["menu_items"]["Row"];

export type MenuOptionGroup = Tables["menu_item_option_groups"]["Row"];

export type MenuOption = Tables["menu_item_options"]["Row"];

// Dữ liệu ghép để UI hiển thị.
// Không phải bảng mới trong database.
export type MenuOptionGroupDetail = MenuOptionGroup & {
  options: MenuOption[];
};

export type MenuItemDetail = MenuItem & {
  option_groups: MenuOptionGroupDetail[];
};

export type RestaurantMenu = {
  restaurant: RestaurantPublic;
  items: MenuItemDetail[];
};
