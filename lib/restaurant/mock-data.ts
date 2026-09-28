import { exploreRestaurants } from "@/lib/explore/mock-data";
import { previewRestaurants } from "@/lib/home/mock-data";

export const menuCategories = [
  "Cơm",
  "Món thêm",
  "Nước uống",
  "Ăn vặt",
] as const;

export type MenuCategory = (typeof menuCategories)[number];

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  available: boolean;
  hasOptions: boolean;
};

export type RestaurantDetail = {
  slug: string;
  name: string;
  location: string;
  description: string;
  hours: string | null;
  isOpen: boolean;
  payments: string[];
  menu: MenuItem[];
};

const comCoBaMenu: MenuItem[] = [
  {
    id: "com-ga-chien",
    name: "Cơm gà chiên",
    description: "Gà chiên giòn, cơm trắng, dưa leo, cà chua.",
    price: 25000,
    category: "Cơm",
    available: true,
    hasOptions: true,
  },
  {
    id: "com-suon-nuong",
    name: "Cơm sườn nướng",
    description: "Sườn nướng thơm ngon, cơm trắng, đồ chua.",
    price: 32000,
    category: "Cơm",
    available: true,
    hasOptions: true,
  },
  {
    id: "com-tam-bi-cha",
    name: "Cơm tấm bì chả",
    description: "Cơm tấm, bì heo, chả trứng, nước mắm.",
    price: 28000,
    category: "Cơm",
    available: true,
    hasOptions: true,
  },
  {
    id: "com-chien-trung",
    name: "Cơm chiên trứng",
    description: "Cơm chiên với trứng, hành lá, cà rốt.",
    price: 25000,
    category: "Cơm",
    available: true,
    hasOptions: false,
  },
  {
    id: "com-thit-kho-tau",
    name: "Cơm thịt kho tàu",
    description: "Thịt kho mềm, trứng, cơm trắng.",
    price: 30000,
    category: "Cơm",
    available: true,
    hasOptions: false,
  },
  {
    id: "canh-rong-bien",
    name: "Canh rong biển",
    description: "Canh rong biển nấu thịt bằm, thanh mát.",
    price: 15000,
    category: "Món thêm",
    available: true,
    hasOptions: true,
  },
  {
    id: "tra-dao-cam-sa",
    name: "Trà đào cam sả",
    description: "Trà đào tươi, cam, sả thơm mát.",
    price: 18000,
    category: "Nước uống",
    available: true,
    hasOptions: false,
  },
  {
    id: "tra-sua-truyen-thong",
    name: "Trà sữa truyền thống",
    description: "Trà sữa béo thơm, trân châu dai.",
    price: 18000,
    category: "Nước uống",
    available: true,
    hasOptions: false,
  },
  {
    id: "tra-tac",
    name: "Trà tắc",
    description: "Trà tắc thanh mát, giải nhiệt.",
    price: 12000,
    category: "Nước uống",
    available: true,
    hasOptions: false,
  },
  {
    id: "khoai-tay-chien",
    name: "Khoai tây chiên",
    description: "Khoai tây chiên giòn, thơm ngon.",
    price: 15000,
    category: "Ăn vặt",
    available: true,
    hasOptions: false,
  },
];

const traSuaNhaLamMenu: MenuItem[] = [
  {
    id: "tra-sua-truyen-thong",
    name: "Trà sữa truyền thống",
    description:
      "Trà sữa thơm béo, vị trà đậm đà hòa quyện cùng sữa tươi, là lựa chọn quen thuộc được nhiều bạn yêu thích.",
    price: 20000,
    category: "Nước uống",
    available: true,
    hasOptions: true,
  },
];

// Bổ sung menu của từng quán tại đây khi có thêm thiết kế/API.
const menus: Record<string, MenuItem[]> = {
  "com-co-ba": comCoBaMenu,
  "tra-sua-nha-lam": traSuaNhaLamMenu,
};

export function getRestaurantDetail(
  slug: string,
): RestaurantDetail | undefined {
  const exploreRestaurant = exploreRestaurants.find(
    (item) => item.id === slug,
  );

  const homeRestaurant = previewRestaurants.find(
    (item) => item.slug === slug,
  );

  if (!exploreRestaurant && !homeRestaurant) {
    return undefined;
  }

  const name = exploreRestaurant?.name ?? homeRestaurant!.name;

  const location =
    exploreRestaurant?.location ?? homeRestaurant?.location ?? "";

  const categories =
    exploreRestaurant?.categories ?? homeRestaurant?.categories ?? [];

  const isOpen =
    exploreRestaurant?.isOpen ??
    (homeRestaurant?.operating_status === "open");

  return {
    slug,
    name,
    location,
    description:
      slug === "com-co-ba"
        ? "Cơm nhà, món Việt, giá sinh viên."
        : categories.join(", "),
    hours: slug === "com-co-ba" ? "10:00 - 14:00" : null,
    isOpen,
    payments: slug === "com-co-ba" ? ["Tiền mặt", "Chuyển khoản"] : [],
    menu: menus[slug] ?? [],
  };
}