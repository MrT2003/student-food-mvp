import type { CartItem, CartRestaurant } from "@/lib/cart/mock-data";

export type CartGroup = {
  restaurant: CartRestaurant;
  items: CartItem[];
  quantity: number;
  subtotal: number;
};

export function getCartItemUnitPrice(item: CartItem): number {
  return (
    item.basePrice + item.extras.reduce((sum, extra) => sum + extra.price, 0)
  );
}

export function getCartItemTotal(item: CartItem): number {
  return getCartItemUnitPrice(item) * item.quantity;
}

export function getCartSummary(
  items: CartItem[],
  restaurants: CartRestaurant[],
) {
  const itemsByRestaurant = new Map<string, CartItem[]>();

  let quantity = 0;
  let subtotal = 0;

  for (const item of items) {
    const bucket = itemsByRestaurant.get(item.restaurantId);

    if (bucket) {
      bucket.push(item);
    } else {
      itemsByRestaurant.set(item.restaurantId, [item]);
    }

    quantity += item.quantity;
    subtotal += getCartItemTotal(item);
  }

  const groups: CartGroup[] = [];

  for (const restaurant of restaurants) {
    const restaurantItems = itemsByRestaurant.get(restaurant.id);
    if (!restaurantItems?.length) continue;

    groups.push({
      restaurant,
      items: restaurantItems,
      quantity: restaurantItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: restaurantItems.reduce(
        (sum, item) => sum + getCartItemTotal(item),
        0,
      ),
    });
  }

  const knownRestaurantIds = new Set(
    restaurants.map((restaurant) => restaurant.id),
  );

  const unknownRestaurantIds = [...itemsByRestaurant.keys()].filter(
    (id) => !knownRestaurantIds.has(id),
  );

  return {
    groups,
    quantity,
    subtotal,
    restaurantCount: itemsByRestaurant.size,
    unknownRestaurantIds,
  };
}
