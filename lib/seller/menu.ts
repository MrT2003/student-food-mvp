import type { MenuItem, MenuOptionGroupDetail } from "@/types/restaurant.types";
import { normalizeSearchText } from "@/lib/format";

// optionCount is presentation metadata, not an extra menu_items database column.
export type SellerMenuRow = { item: MenuItem; optionCount: number; optionGroups?: MenuOptionGroupDetail[]; featuredPreview?: boolean };
export type MenuTab = "all" | "selling" | "unavailable" | "hidden";
export const menuCategories = ["Cơm", "Đồ uống", "Ăn vặt"];
export function menuStatus(item: MenuItem): Exclude<MenuTab, "all"> {
  return !item.is_active ? "hidden" : item.is_available ? "selling" : "unavailable";
}
export function filterSellerMenu(rows: SellerMenuRow[], query: string, category: string, tab: MenuTab, sort: string) {
  const search = normalizeSearchText(query);
  return rows.filter(({ item }) => normalizeSearchText(item.name).includes(search) &&
    (!category || item.category === category) && (tab === "all" || menuStatus(item) === tab))
    .sort((a, b) => sort === "price" ? a.item.price - b.item.price : sort === "name"
      ? a.item.name.localeCompare(b.item.name, "vi") : Date.parse(b.item.updated_at) - Date.parse(a.item.updated_at));
}
export function createSellerMenuFixtures(_restaurantId: string): SellerMenuRow[] {
  return [];
}
