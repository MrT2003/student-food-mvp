import type { SelectedOption } from "@/types/cart.types";

export { getCartItemTotal } from "@/lib/cart/calculations";
export type CartExtra = {
  id: string;
  name: string;
  price: number;
};

export type CartItem = {
  id: string;
  restaurantId: string;

  // ID món trong menu, khác với ID dòng trong giỏ.
  menuItemId?: string;
  selection?: CartSelection;

  name: string;
  basePrice: number;
  quantity: number;
  extras: CartExtra[];
  note: string;
  kind: "food" | "drink";
  // Dữ liệu chuẩn mới, dùng trong giai đoạn chuyển đổi.
  selected_options?: SelectedOption[];
  image_url?: string | null;
};
export const cartRestaurants = [
  {
    id: "com-co-ba",
    name: "Cơm Cô Ba",
    location: "KTX A",
    isOpen: true,
    kind: "food",
  },
  {
    id: "tra-sua-nha-lam",
    name: "Trà Sữa Nhà Làm",
    location: "KTX B",
    isOpen: true,
    kind: "drink",
  },
] as const;

// Giá riêng của bản UI Cart, theo ảnh thiết kế.
// Khi nối API cần dùng chung nguồn giá với menu.
export const initialCartItems: CartItem[] = [
  {
    id: "cart-chicken",
    restaurantId: "com-co-ba",
    name: "Cơm gà chiên",
    basePrice: 35000,
    quantity: 1,
    extras: [{ id: "egg", name: "Thêm trứng", price: 7000 }],
    note: "Ít cơm",
    kind: "food",
  },
  {
    id: "cart-ribs",
    restaurantId: "com-co-ba",
    name: "Cơm sườn nướng",
    basePrice: 30000,
    quantity: 1,
    extras: [],
    note: "",
    kind: "food",
  },
  {
    id: "cart-milk-tea",
    restaurantId: "tra-sua-nha-lam",
    name: "Trà sữa truyền thống",
    basePrice: 20000,
    quantity: 1,
    extras: [
      { id: "pearls", name: "Trân châu đen", price: 5000 },
      { id: "jelly", name: "Thạch trái cây", price: 4000 },
    ],
    note: "Ít đá · 50% đường",
    kind: "drink",
  },
  {
    id: "cart-peach-tea",
    restaurantId: "tra-sua-nha-lam",
    name: "Trà đào cam sả",
    basePrice: 25000,
    quantity: 1,
    extras: [],
    note: "",
    kind: "drink",
  },
];

export type CartRestaurant = {
  id: string;
  name: string;
  location: string;
  isOpen: boolean;
  kind: "food" | "drink";
};

export type CartSelection = {
  toppingIds: string[];
  sugarId: string;
  iceId: string;
};
