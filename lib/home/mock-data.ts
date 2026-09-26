import type { HomeRestaurant } from "@/types/home.types";

// UI fixtures only. Replace with service results when the API is ready.
export type PreviewRestaurant = HomeRestaurant & {
  illustration: "rice" | "tea" | "noodles" | "spicy" | "bread" | "chicken";
  orderCount: number;
  searchTerms: string[];
};

export const previewAccount = { name: "Nguyễn Văn A", initial: "N", unreadCount: 3 };

export const previewRestaurants: PreviewRestaurant[] = [
  { id: "demo-com-co-ba", slug: "com-co-ba", name: "Cơm Cô Ba", location: "KTX A", description: "Cơm, Món Việt", avatar_url: null, operating_status: "open", menuItemCount: 12, categories: ["Cơm", "Món Việt"], illustration: "rice", orderCount: 3, searchTerms: ["cơm gà", "cơm sườn"] },
  { id: "demo-tra-sua", slug: "tra-sua-nha-lam", name: "Trà Sữa Nhà Làm", location: "KTX B", description: "Trà sữa, Đồ uống", avatar_url: null, operating_status: "open", menuItemCount: 18, categories: ["Trà sữa", "Đồ uống"], illustration: "tea", orderCount: 5, searchTerms: ["trân châu", "trà đào"] },
  { id: "demo-bun-cha", slug: "bun-cha-ha-noi", name: "Bún Chả Hà Nội", location: "KTX A", description: "Bún, Món Việt", avatar_url: null, operating_status: "open", menuItemCount: 10, categories: ["Bún", "Món Việt"], illustration: "noodles", orderCount: 2, searchTerms: ["bún chả", "nem rán"] },
  { id: "demo-mi-cay", slug: "mi-cay-seoul", name: "Mì Cay Seoul", location: "KTX B", description: "Món Hàn, Ăn vặt", avatar_url: null, operating_status: "open", menuItemCount: 14, categories: ["Món Hàn", "Ăn vặt"], illustration: "spicy", orderCount: 4, searchTerms: ["mì cay", "tokbokki"] },
  { id: "demo-banh-mi", slug: "banh-mi-sau", name: "Bánh Mì Sáu", location: "KTX A", description: "Bánh mì, Ăn vặt", avatar_url: null, operating_status: "open", menuItemCount: 9, categories: ["Bánh mì", "Ăn vặt"], illustration: "bread", orderCount: 6, searchTerms: ["bánh mì thịt", "bánh mì trứng"] },
  { id: "demo-ga-ran", slug: "ga-ran-campus", name: "Gà Rán Campus", location: "KTX B", description: "Gà rán, Ăn vặt", avatar_url: null, operating_status: "open", menuItemCount: 16, categories: ["Gà rán", "Ăn vặt"], illustration: "chicken", orderCount: 3, searchTerms: ["gà rán", "khoai tây chiên"] },
];

export const previewNotifications = ["Cơm Cô Ba đang mở cửa nhận đơn.", "Khám phá món ngon mới quanh KTX B.", "Chào mừng bạn đến với StudentFood!"];
