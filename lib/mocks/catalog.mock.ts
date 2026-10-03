import type {
  MenuItem,
  MenuItemDetail,
  MenuOption,
  MenuOptionGroup,
  RestaurantPublic,
} from "@/types/restaurant.types";

const CREATED_AT = "2026-09-01T00:00:00.000Z";

// Chỉ dùng để tạo UUID cố định cho fixture demo.
// Số seed đã cấp không được đổi hoặc tái sử dụng cho bản ghi khác.
function fixtureId(
  table: "restaurant" | "item" | "group" | "option",
  seed: number,
): string {
  const prefixes = {
    restaurant: "10000000",
    item: "20000000",
    group: "30000000",
    option: "40000000",
  } as const;

  return `${prefixes[table]}-0000-4000-8000-${String(seed).padStart(12, "0")}`;
}

type RestaurantSeed = {
  seed: number;
  slug: string;
  name: string;
  location: string;
  description: string;
};

const restaurantSeeds: RestaurantSeed[] = [
  {
    seed: 1,
    slug: "com-co-ba",
    name: "Cơm Cô Ba",
    location: "KTX A",
    description: "Cơm nhà, món Việt, giá sinh viên.",
  },
  {
    seed: 2,
    slug: "tra-sua-nha-lam",
    name: "Trà Sữa Nhà Làm",
    location: "KTX B",
    description: "Trà sữa và đồ uống.",
  },
  {
    seed: 3,
    slug: "bun-cha-ha-noi",
    name: "Bún Chả Hà Nội",
    location: "KTX A",
    description: "Bún chả và món Việt.",
  },
  {
    seed: 4,
    slug: "mi-cay-seoul",
    name: "Mì Cay Seoul",
    location: "KTX B",
    description: "Món Hàn và ăn vặt.",
  },
  {
    seed: 5,
    slug: "an-vat-5k",
    name: "Ăn Vặt 5K",
    location: "KTX A",
    description: "Ăn vặt và đồ chiên.",
  },
  {
    seed: 6,
    slug: "com-tam-dem",
    name: "Cơm Tấm Đêm",
    location: "KTX B",
    description: "Cơm tấm và món Việt.",
  },
  {
    seed: 7,
    slug: "xien-que-mr-beo",
    name: "Xiên Que Mr.Béo",
    location: "KTX A",
    description: "Ăn vặt và đồ nướng.",
  },
  {
    seed: 8,
    slug: "banh-mi-3t",
    name: "Bánh Mì 3T",
    location: "KTX B",
    description: "Bánh mì và ăn vặt.",
  },
  {
    seed: 9,
    slug: "ga-ran-campus",
    name: "Gà Rán Campus",
    location: "KTX A",
    description: "Gà rán và đồ chiên.",
  },
  {
    seed: 10,
    slug: "banh-mi-sau",
    name: "Bánh Mì Sáu",
    location: "KTX A",
    description: "Bánh mì và ăn vặt.",
  },
];

export const mockRestaurants: RestaurantPublic[] = restaurantSeeds.map(
  (restaurant) => ({
    id: fixtureId("restaurant", restaurant.seed),
    slug: restaurant.slug,
    name: restaurant.name,
    description: restaurant.description,
    location: restaurant.location,
    avatar_url: null,
    status: "active",
    operating_status: "open",
    operating_hours: null,
  }),
);

// Tuple chỉ là cách viết fixture ngắn gọn.
// Dữ liệu xuất ra bên dưới vẫn dùng đúng tên cột database.
type MenuSeed = readonly [
  seed: number,
  restaurantSeed: number,
  localSlug: string,
  name: string,
  price: number,
  category: string,
];

const menuSeeds: MenuSeed[] = [
  [1, 1, "com-ga-chien", "Cơm gà chiên", 25000, "Cơm"],
  [2, 1, "com-suon-nuong", "Cơm sườn nướng", 32000, "Cơm"],
  [3, 1, "com-tam-bi-cha", "Cơm tấm bì chả", 28000, "Cơm"],
  [4, 1, "com-chien-trung", "Cơm chiên trứng", 25000, "Cơm"],
  [5, 1, "com-thit-kho-tau", "Cơm thịt kho tàu", 30000, "Cơm"],
  [6, 1, "canh-rong-bien", "Canh rong biển", 15000, "Món thêm"],
  [7, 1, "tra-dao-cam-sa", "Trà đào cam sả", 18000, "Nước uống"],
  [8, 1, "tra-sua-truyen-thong", "Trà sữa truyền thống", 18000, "Nước uống"],
  [9, 1, "tra-tac", "Trà tắc", 12000, "Nước uống"],
  [10, 1, "khoai-tay-chien", "Khoai tây chiên", 15000, "Ăn vặt"],
  [11, 1, "com-ga-teriyaki", "Cơm gà sốt teriyaki", 25000, "Cơm"],

  [12, 2, "tra-sua-truyen-thong", "Trà sữa truyền thống", 20000, "Nước uống"],
  [13, 2, "tra-sua-tran-chau", "Trà sữa trân châu", 18000, "Nước uống"],
  [14, 2, "tra-dao-cam-sa", "Trà đào cam sả", 20000, "Nước uống"],

  [15, 3, "bun-cha-dac-biet", "Bún chả đặc biệt", 28000, "Món chính"],
  [16, 4, "mi-cay-hai-san", "Mì cay hải sản", 30000, "Món chính"],

  [17, 5, "xien-que-thap-cam", "Xiên que thập cẩm", 10000, "Ăn vặt"],
  [18, 5, "khoai-tay-chien", "Khoai tây chiên", 15000, "Ăn vặt"],
  [19, 5, "banh-trang-tron", "Bánh tráng trộn", 15000, "Ăn vặt"],

  [20, 6, "com-tam-suon-nuong", "Cơm tấm sườn nướng", 28000, "Cơm"],
  [21, 8, "banh-mi-bo-nuong", "Bánh mì bò nướng", 22000, "Ăn vặt"],
  [22, 9, "ga-ran-campus", "Gà rán Campus", 26000, "Ăn vặt"],
];

export const mockMenuItems: MenuItem[] = menuSeeds.map(
  ([seed, restaurantSeed, localSlug, name, price, category]) => {
    const restaurant = restaurantSeeds.find(
      (entry) => entry.seed === restaurantSeed,
    );

    if (!restaurant) {
      throw new Error(`Fixture món ${seed} tham chiếu quán không tồn tại.`);
    }

    return {
      id: fixtureId("item", seed),
      restaurant_id: fixtureId("restaurant", restaurantSeed),

      // Có tiền tố quán để tránh trùng slug giữa các quán.
      slug: `${restaurant.slug}-${localSlug}`,

      name,
      description: `${name} — món ăn trong thực đơn của quán.`,
      price,
      category,
      image_url: null,
      is_active: true,
      is_available: true,
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
    };
  },
);

// Giữ thông tin đường dẫn cũ riêng khỏi dữ liệu database.
// Adapter UI ở bước tiếp theo có thể dùng để hỗ trợ URL cũ.
export const mockMenuRouteAliases = menuSeeds.map(
  ([seed, restaurantSeed, localSlug]) => ({
    menu_item_id: fixtureId("item", seed),
    restaurant_id: fixtureId("restaurant", restaurantSeed),
    legacy_slug: localSlug,
  }),
);

// Các nhóm tùy chọn của Trà sữa truyền thống / Trà Sữa Nhà Làm.
const MILK_TEA_ID = fixtureId("item", 12);

export const mockOptionGroups: MenuOptionGroup[] = [
  {
    id: fixtureId("group", 1),
    menu_item_id: MILK_TEA_ID,
    name: "Topping thêm",
    is_required: false,
    is_multiple: true,
    is_active: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  },
  {
    id: fixtureId("group", 2),
    menu_item_id: MILK_TEA_ID,
    name: "Mức đường",
    is_required: true,
    is_multiple: false,
    is_active: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  },
  {
    id: fixtureId("group", 3),
    menu_item_id: MILK_TEA_ID,
    name: "Mức đá",
    is_required: true,
    is_multiple: false,
    is_active: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  },
];

type OptionSeed = readonly [
  seed: number,
  groupSeed: number,
  name: string,
  additionalPrice: number,
];

const optionSeeds: OptionSeed[] = [
  [1, 1, "Trân châu đen", 5000],
  [2, 1, "Thạch trái cây", 4000],
  [3, 1, "Pudding", 6000],

  [4, 2, "100% đường", 0],
  [5, 2, "70% đường", 0],
  [6, 2, "50% đường", 0],
  [7, 2, "30% đường", 0],
  [8, 2, "0% đường", 0],

  [9, 3, "Bình thường", 0],
  [10, 3, "Ít đá", 0],
  [11, 3, "Không đá", 0],
];

export const mockOptions: MenuOption[] = optionSeeds.map(
  ([seed, groupSeed, name, additionalPrice]) => ({
    id: fixtureId("option", seed),
    group_id: fixtureId("group", groupSeed),
    option_name: name,
    additional_price: additionalPrice,
    is_active: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  }),
);

// Dữ liệu ghép phục vụ UI và tính toán giỏ hàng.
// Không phải cấu trúc bảng mới.
export const mockMenuItemDetails: MenuItemDetail[] = mockMenuItems.map(
  (item) => ({
    ...item,
    option_groups: mockOptionGroups
      .filter((group) => group.menu_item_id === item.id)
      .map((group) => ({
        ...group,
        options: mockOptions.filter((option) => option.group_id === group.id),
      })),
  }),
);
