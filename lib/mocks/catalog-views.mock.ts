import { mockRestaurants, mockMenuItems } from "@/lib/mocks/catalog.mock";

export type FoodKind = "rice" | "tea" | "noodles" | "snack" | "bread";

export type HomeIllustration =
  | "rice"
  | "tea"
  | "noodles"
  | "spicy"
  | "bread"
  | "chicken";

type Presentation = {
  categories: string[];
  kind: FoodKind;
  illustration: HomeIllustration;
  popularity: number;
};

// Chỉ là nhãn phân loại, hình minh họa và thứ tự DEMO.
// Không phải cột mới trong database.
// Không khai báo lại tên quán, giá món hoặc địa chỉ ở đây.
const presentations: Record<string, Presentation> = {
  "com-co-ba": {
    categories: ["Cơm", "Món Việt"],
    kind: "rice",
    illustration: "rice",
    popularity: 100,
  },
  "tra-sua-nha-lam": {
    categories: ["Trà sữa", "Đồ uống"],
    kind: "tea",
    illustration: "tea",
    popularity: 95,
  },
  "bun-cha-ha-noi": {
    categories: ["Bún", "Món Việt"],
    kind: "noodles",
    illustration: "noodles",
    popularity: 90,
  },
  "mi-cay-seoul": {
    categories: ["Món Hàn", "Ăn vặt"],
    kind: "noodles",
    illustration: "spicy",
    popularity: 85,
  },
  "an-vat-5k": {
    categories: ["Ăn vặt", "Đồ chiên"],
    kind: "snack",
    illustration: "chicken",
    popularity: 80,
  },
  "com-tam-dem": {
    categories: ["Cơm", "Món Việt"],
    kind: "rice",
    illustration: "rice",
    popularity: 75,
  },
  "xien-que-mr-beo": {
    categories: ["Ăn vặt", "Đồ nướng"],
    kind: "snack",
    illustration: "chicken",
    popularity: 70,
  },
  "banh-mi-3t": {
    categories: ["Bánh mì", "Ăn vặt"],
    kind: "bread",
    illustration: "bread",
    popularity: 65,
  },
  "ga-ran-campus": {
    categories: ["Ăn vặt", "Đồ chiên"],
    kind: "snack",
    illustration: "chicken",
    popularity: 60,
  },
  "banh-mi-sau": {
    categories: ["Bánh mì", "Ăn vặt"],
    kind: "bread",
    illustration: "bread",
    popularity: 55,
  },
};

// Tạo dữ liệu một lần khi module được nạp,
// không tạo lại bên trong mỗi lần render component.
export const catalogRestaurantViews = mockRestaurants
  .filter((restaurant) => restaurant.status === "active")
  .map((restaurant) => {
    const items = mockMenuItems.filter(
      (item) => item.restaurant_id === restaurant.id && item.is_active,
    );

    const presentation = presentations[restaurant.slug];

    const categories = presentation?.categories ?? [
      ...new Set(
        items.flatMap((item) => (item.category ? [item.category] : [])),
      ),
    ];

    return {
      restaurant,
      items,
      categories,
      kind: presentation?.kind ?? "rice",
      illustration: presentation?.illustration ?? "rice",
      popularity: presentation?.popularity ?? 0,
      searchTerms: items.map((item) => item.name),
    };
  });

// Thứ tự demo của 12 món phổ biến.
// Chỉ tham chiếu slug, không lưu lại tên hoặc giá món.
export const popularMenuSlugs = [
  "com-co-ba-com-ga-teriyaki",
  "tra-sua-nha-lam-tra-sua-tran-chau",
  "bun-cha-ha-noi-bun-cha-dac-biet",
  "mi-cay-seoul-mi-cay-hai-san",
  "an-vat-5k-xien-que-thap-cam",
  "com-tam-dem-com-tam-suon-nuong",
  "tra-sua-nha-lam-tra-dao-cam-sa",
  "banh-mi-3t-banh-mi-bo-nuong",
  "ga-ran-campus-ga-ran-campus",
  "com-co-ba-com-chien-trung",
  "an-vat-5k-khoai-tay-chien",
  "an-vat-5k-banh-trang-tron",
] as const;

export function getDishKind(
  category: string | null,
  fallback: FoodKind,
): FoodKind {
  if (category === "Nước uống") return "tea";
  if (category === "Cơm") return "rice";
  if (category === "Món chính") return "noodles";
  if (category === "Ăn vặt") {
    return fallback === "bread" ? "bread" : "snack";
  }

  return fallback;
}
