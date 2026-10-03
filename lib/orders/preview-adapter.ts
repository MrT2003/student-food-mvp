import type { CartItem as CartRow } from "@/types/cart.types";

import type { OrderDetail, OrderStatus } from "@/types/order.types";

import type {
  CartItem as CartItemView,
  CartRestaurant,
} from "@/lib/cart/mock-data";

import { mockRestaurants, mockMenuItemDetails } from "@/lib/mocks/catalog.mock";

import { resolveSelectedOptions } from "@/lib/cart/options";

export type PreviewOrder = {
  id: string;
  orderCode: string;
  status: OrderStatus;
  restaurantId: string;
  restaurantName: string;
  restaurantLocation: string;
  kind: "food" | "drink";
  quantity: number;
  total: number;
  payment: "bank" | "cash";
  note: string;
  items: CartItemView[];
};

export type SavedPreviewOrder = PreviewOrder & {
  createdAt: string;
  deliveryLocation: string;
  deliveryAddress: string;
  deliveryFee: number;
};

// Chuyển dữ liệu cart chuẩn thành dữ liệu hiển thị.
// Không phải payload gửi database.
export function projectCart(rows: CartRow[]): {
  items: CartItemView[];
  restaurants: CartRestaurant[];
} {
  const restaurants = new Map<string, CartRestaurant>();

  const items: CartItemView[] = rows.map((row) => {
    const restaurant = mockRestaurants.find(
      (entry) => entry.id === row.restaurant_id,
    );

    const menuItem = mockMenuItemDetails.find(
      (entry) =>
        entry.id === row.menu_item_id &&
        entry.restaurant_id === row.restaurant_id,
    );

    if (!restaurant || !menuItem) {
      throw new Error("Không tìm thấy quán hoặc món trong giỏ.");
    }

    const options = resolveSelectedOptions(menuItem, row.selected_options);

    const kind = menuItem.category === "Nước uống" ? "drink" : "food";

    const existingRestaurant = restaurants.get(restaurant.id);

    restaurants.set(restaurant.id, {
      id: restaurant.id,
      name: restaurant.name,
      location: restaurant.location ?? "",
      isOpen:
        restaurant.status === "active" &&
        restaurant.operating_status === "open",

      // Quán có món ăn và đồ uống thì dùng biểu tượng món ăn.
      kind:
        existingRestaurant?.kind === "food" || kind === "food"
          ? "food"
          : "drink",
    });

    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      menuItemId: row.menu_item_id,
      name: menuItem.name,
      basePrice: menuItem.price,
      quantity: row.quantity,
      kind,
      image_url: menuItem.image_url,
      selected_options: row.selected_options.map((option) => ({
        ...option,
      })),
      extras: options.map((option) => ({
        id: option.option_id,
        name: `${option.group_name}: ${option.option_name}`,
        price: option.additional_price,
      })),
      note: "",
    };
  });

  return {
    items,
    restaurants: [...restaurants.values()],
  };
}

// Chuyển đơn đã tạo sang kiểu UI cũ.
// Tên món, giá và tùy chọn đều lấy từ snapshot.
export function projectOrder(
  order: OrderDetail,
  deliveryLocation: string,
  deliveryAddress: string,
): SavedPreviewOrder {
  const restaurant = mockRestaurants.find(
    (entry) => entry.id === order.restaurant_id,
  );

  const items: CartItemView[] = order.order_items.map((item) => {
    const optionPrice = item.option_snapshot_price.reduce(
      (sum, option) => sum + option.additional_price,
      0,
    );

    const menuItem = mockMenuItemDetails.find(
      (entry) => entry.id === item.menu_item_id,
    );

    return {
      id: item.id,
      restaurantId: order.restaurant_id,
      menuItemId: item.menu_item_id ?? undefined,
      name: item.item_name_snapshot,

      // UI cũ tính basePrice + extras.
      // unit_price_snapshot đã bao gồm extras nên phải trừ ra.
      basePrice: item.unit_price_snapshot - optionPrice,

      quantity: item.quantity,
      image_url: item.image_url,

      // Chỉ dùng menu hiện tại để chọn biểu tượng.
      // Không dùng menu để tính lại giá đơn cũ.
      kind: menuItem?.category === "Nước uống" ? "drink" : "food",

      extras: item.option_snapshot_price.map((option) => ({
        id: option.option_id,
        name: `${option.group_name}: ${option.option_name}`,
        price: option.additional_price,
      })),
      note: "",
    };
  });

  return {
    id: order.id,
    orderCode: order.order_code,
    status: order.order_status,
    restaurantId: order.restaurant_id,
    restaurantName: restaurant?.name ?? "Cửa hàng không còn khả dụng",
    restaurantLocation: restaurant?.location ?? "",
    kind:
      items.length > 0 && items.every((item) => item.kind === "drink")
        ? "drink"
        : "food",
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    total: order.total,
    payment: order.payment_method === "bank_transfer" ? "bank" : "cash",
    note: order.customer_notes ?? "",
    items,
    createdAt: order.created_at,
    deliveryLocation,
    deliveryAddress,
    deliveryFee: order.total - order.subtotal,
  };
}
