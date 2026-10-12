import type { HomeRestaurant } from "@/types/home.types";
import {
  catalogRestaurantViews,
  type HomeIllustration,
} from "@/lib/mocks/catalog-views.mock";

export type PreviewRestaurant = HomeRestaurant & {
  illustration: HomeIllustration;
  orderCount: number;
  searchTerms: string[];
};

export const previewAccount = {
  name: "Nguyễn Văn A",
  initial: "N",
  unreadCount: 3,
};

// Giữ sáu quán và thứ tự Trang chủ hiện tại.
const homeSlugs = [
  "com-co-ba",
  "tra-sua-nha-lam",
  "bun-cha-ha-noi",
  "mi-cay-seoul",
  "banh-mi-sau",
  "ga-ran-campus",
];

// Chỉ giữ tương thích với phần Đặt lại nhanh hiện tại.
// Sẽ thay bằng lịch sử đơn hàng ở bước xử lý orders.
const demoOrderCounts: Record<string, number> = {
  "com-co-ba": 3,
  "tra-sua-nha-lam": 5,
  "bun-cha-ha-noi": 2,
  "mi-cay-seoul": 4,
  "banh-mi-sau": 6,
  "ga-ran-campus": 3,
};

export const previewRestaurants: PreviewRestaurant[] = homeSlugs.flatMap(
  (slug) => {
    const view = catalogRestaurantViews.find(
      (entry) => entry.restaurant.slug === slug,
    );

    if (!view) return [];

    const { restaurant } = view;

    return [
      {
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
        description: restaurant.description,
        avatar_url: restaurant.avatar_url,
        location: restaurant.location,
        operating_status: restaurant.operating_status,

        menuItemCount: view.items.length,
        categories: [...view.categories],
        illustration: view.illustration,
        searchTerms: [...view.searchTerms],
        orderCount: demoOrderCounts[slug] ?? 0,
      },
    ];
  },
);

export const previewNotifications = [
  "Khám phá các quán ăn quanh khu ký túc xá.",
  "Xem những món ăn phổ biến hôm nay.",
  "Chào mừng bạn đến với StudentFood!",
];
