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
export function createSellerMenuFixtures(restaurantId: string): SellerMenuRow[] {
  const seeds: [string, string, number, string, number, boolean, boolean][] = [
    ["Cơm gà chiên", "Cơm", 30000, "Cơm trắng dẻo thơm, gà chiên giòn, ăn kèm dưa leo và nước mắm.", 3, true, true],
    ["Cơm sườn nướng", "Cơm", 32000, "Cơm tấm sườn nướng đậm vị, ăn kèm đồ chua và mỡ hành.", 2, true, false],
    ["Trà đào cam sả", "Đồ uống", 25000, "Trà đen thơm, đào tươi, cam sả thanh mát, ít ngọt.", 1, true, true],
    ["Trà sữa truyền thống", "Đồ uống", 20000, "Trà sữa thơm béo, trân châu đen dai mềm.", 2, true, true],
    ["Bánh tráng trộn", "Ăn vặt", 20000, "Bánh tráng dai ngon, xoài bào, trứng cút, khô bò, sa tế đặc biệt.", 0, false, true],
    ["Cơm tấm bì chả", "Cơm", 35000, "Bì chả thơm ngon, cơm tấm nóng hổi.", 2, true, true],
    ["Cơm chiên trứng", "Cơm", 22000, "Cơm chiên vàng với trứng và rau củ.", 1, true, true],
    ["Cơm bò xào", "Cơm", 38000, "Thịt bò mềm, rau củ tươi.", 1, true, true],
    ["Trà tắc", "Đồ uống", 12000, "Trà tắc mát lạnh, chua ngọt dịu.", 1, true, true],
    ["Nước cam", "Đồ uống", 18000, "Cam tươi ép nguyên chất.", 0, true, false],
    ["Khoai tây chiên", "Ăn vặt", 15000, "Khoai giòn vàng, ăn kèm tương cà.", 1, true, true],
    ["Xiên que", "Ăn vặt", 10000, "Xiên que chiên nóng, sốt cay nhẹ.", 0, false, true],
  ];
  return seeds.map(([name, category, price, description, optionCount, is_active, is_available], index) => ({
    optionCount,
    item: { id: `71000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      restaurant_id: restaurantId, name, category, price, description, image_url: null,
      slug: normalizeSearchText(name).replace(/\s+/g, "-"), is_active, is_available,
      created_at: "2026-09-10T00:00:00Z", updated_at: new Date(Date.UTC(2026, 8, 10, 12, 0, -index)).toISOString() },
  }));
}
