import type { CartItem as CartRow } from "@/types/cart.types";
import { mockRestaurants, mockMenuItemDetails } from "@/lib/mocks/catalog.mock";
import { resolveSelectedOptions } from "@/lib/cart/options";

// Presentation only: derived from canonical cart rows, never stored or sent to API.
export type CartItem = {
  id: string; restaurantId: string; name: string; basePrice: number; quantity: number;
  extras: { id: string; name: string; price: number }[];
  kind: "food" | "drink";
};
export type CartRestaurant = {
  id: string; name: string; location: string; isOpen: boolean; kind: "food" | "drink";
};

export function projectCart(rows: CartRow[]): { items: CartItem[]; restaurants: CartRestaurant[] } {
  const restaurants = new Map<string, CartRestaurant>();
  const items = rows.map((row): CartItem => {
    const restaurant = mockRestaurants.find((r) => r.id === row.restaurant_id);
    const menu = mockMenuItemDetails.find((m) => m.id === row.menu_item_id && m.restaurant_id === row.restaurant_id);
    if (!restaurant || !menu) throw new Error("Không tìm thấy quán hoặc món trong giỏ.");
    const options = resolveSelectedOptions(menu, row.selected_options);
    const kind = menu.category === "Nước uống" ? "drink" : "food";
    restaurants.set(restaurant.id, {
      id: restaurant.id, name: restaurant.name, location: restaurant.location ?? "",
      isOpen: restaurant.status === "active" && restaurant.operating_status === "open",
      kind: restaurants.get(restaurant.id)?.kind === "food" || kind === "food" ? "food" : "drink",
    });
    return {
      id: row.id, restaurantId: row.restaurant_id, name: menu.name,
      basePrice: menu.price, quantity: row.quantity, kind,
      extras: options.map((o) => ({ id: o.option_id, name: `${o.group_name}: ${o.option_name}`, price: o.additional_price })),
    };
  });
  return { items, restaurants: [...restaurants.values()] };
}
