// Kiểu dữ liệu dành cho UI demo.
// Khi có API, chuyển dữ liệu trả về thành cấu trúc này.
export type FoodKind = "rice" | "tea" | "noodles" | "snack" | "bread";

export type ExploreRestaurant = {
  id: string;
  name: string;
  location: "KTX A" | "KTX B";
  menuCount: number;
  categories: string[];
  isOpen: boolean;
  popularity: number;
  kind: FoodKind;
};

export type ExploreDish = {
  id: string;
  name: string;
  price: number;
  restaurantId: string;
  kind: FoodKind;
};

export const exploreRestaurants: ExploreRestaurant[] = [
  {
    id: "com-co-ba",
    name: "Cơm Cô Ba",
    location: "KTX A",
    menuCount: 12,
    categories: ["Cơm", "Món Việt"],
    isOpen: true,
    popularity: 100,
    kind: "rice",
  },
  {
    id: "tra-sua-nha-lam",
    name: "Trà Sữa Nhà Làm",
    location: "KTX B",
    menuCount: 18,
    categories: ["Trà sữa", "Đồ uống"],
    isOpen: true,
    popularity: 95,
    kind: "tea",
  },
  {
    id: "bun-cha-ha-noi",
    name: "Bún Chả Hà Nội",
    location: "KTX A",
    menuCount: 10,
    categories: ["Bún", "Món Việt"],
    isOpen: true,
    popularity: 90,
    kind: "noodles",
  },
  {
    id: "mi-cay-seoul",
    name: "Mì Cay Seoul",
    location: "KTX B",
    menuCount: 14,
    categories: ["Món Hàn", "Ăn vặt"],
    isOpen: true,
    popularity: 85,
    kind: "noodles",
  },
  {
    id: "an-vat-5k",
    name: "Ăn Vặt 5K",
    location: "KTX A",
    menuCount: 20,
    categories: ["Ăn vặt", "Đồ chiên"],
    isOpen: true,
    popularity: 80,
    kind: "snack",
  },
  {
    id: "com-tam-dem",
    name: "Cơm Tấm Đêm",
    location: "KTX B",
    menuCount: 16,
    categories: ["Cơm", "Món Việt"],
    isOpen: true,
    popularity: 75,
    kind: "rice",
  },
  {
    id: "xien-que-mr-beo",
    name: "Xiên Que Mr.Béo",
    location: "KTX A",
    menuCount: 12,
    categories: ["Ăn vặt", "Đồ nướng"],
    isOpen: true,
    popularity: 70,
    kind: "snack",
  },
  {
    id: "banh-mi-3t",
    name: "Bánh Mì 3T",
    location: "KTX B",
    menuCount: 9,
    categories: ["Bánh mì", "Ăn vặt"],
    isOpen: true,
    popularity: 65,
    kind: "bread",
  },
];

export const popularDishes: ExploreDish[] = [
  {
    id: "com-ga-teriyaki",
    name: "Cơm gà sốt teriyaki",
    price: 25000,
    restaurantId: "com-co-ba",
    kind: "rice",
  },
  {
    id: "tra-sua-tran-chau",
    name: "Trà sữa trân châu",
    price: 18000,
    restaurantId: "tra-sua-nha-lam",
    kind: "tea",
  },
  {
    id: "bun-cha-dac-biet",
    name: "Bún chả đặc biệt",
    price: 28000,
    restaurantId: "bun-cha-ha-noi",
    kind: "noodles",
  },
  {
    id: "mi-cay-hai-san",
    name: "Mì cay hải sản",
    price: 30000,
    restaurantId: "mi-cay-seoul",
    kind: "noodles",
  },
  {
    id: "xien-que-thap-cam",
    name: "Xiên que thập cẩm",
    price: 10000,
    restaurantId: "an-vat-5k",
    kind: "snack",
  },
  {
    id: "com-tam-suon-nuong",
    name: "Cơm tấm sườn nướng",
    price: 28000,
    restaurantId: "com-tam-dem",
    kind: "rice",
  },
];

// Quán bổ sung cho trang món phổ biến.
exploreRestaurants.push({
  id: "ga-ran-campus",
  name: "Gà Rán Campus",
  location: "KTX A",
  menuCount: 1,
  categories: ["Ăn vặt", "Đồ chiên"],
  isOpen: true,
  popularity: 60,
  kind: "snack",
});

popularDishes.push(
  {
    id: "tra-dao-cam-sa",
    name: "Trà đào cam sả",
    price: 20000,
    restaurantId: "tra-sua-nha-lam",
    kind: "tea",
  },
  {
    id: "banh-mi-bo-nuong",
    name: "Bánh mì bò nướng",
    price: 22000,
    restaurantId: "banh-mi-3t",
    kind: "bread",
  },
  {
    id: "ga-ran-campus",
    name: "Gà rán Campus",
    price: 26000,
    restaurantId: "ga-ran-campus",
    kind: "snack",
  },
  {
    id: "com-chien-trung",
    name: "Cơm chiên trứng",
    price: 25000,
    restaurantId: "com-co-ba",
    kind: "rice",
  },
  {
    id: "khoai-tay-chien",
    name: "Khoai tây chiên",
    price: 15000,
    restaurantId: "an-vat-5k",
    kind: "snack",
  },
  {
    id: "banh-trang-tron",
    name: "Bánh tráng trộn",
    price: 15000,
    restaurantId: "an-vat-5k",
    kind: "snack",
  },
);
