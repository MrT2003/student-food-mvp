import type { SelectedOption } from "@/types/cart.types";
import type {
  MenuItemDetail,
  MenuOption,
  MenuOptionGroupDetail,
  RestaurantPublic,
} from "@/types/restaurant.types";
import {
  mockMenuItemDetails,
  mockRestaurants,
} from "@/lib/mocks/catalog.mock";

export type Topping = {
  id: string;
  name: string;
  price: number;
};

export type Choice = {
  id: string;
  label: string;
  description: string;
};

export type DishOptions = {
  toppings: Topping[];
  sugars: Choice[];
  iceLevels: Choice[];
  defaultToppingIds: string[];
  defaultSugarId: string;
  defaultIceId: string;
};

export type OptionGroupKind =
  | "topping"
  | "food-extra"
  | "sugar"
  | "ice"
  | "other";

export type OptionArtworkKind =
  | "pearls"
  | "fruit-jelly"
  | "pudding"
  | "extra-rice"
  | "extra-soup"
  | "extra-ribs"
  | "extra-egg"
  | "extra-pork-skin"
  | "extra-meatloaf"
  | "extra-fish-sauce"
  | "extra-cutlery"
  | "generic";

const CREATED_AT = "2026-09-01T00:00:00.000Z";

const milkTeaOptions: DishOptions = {
  toppings: [
    { id: "pearls", name: "Trân châu đen", price: 5000 },
    { id: "fruit-jelly", name: "Thạch trái cây", price: 4000 },
    { id: "pudding", name: "Pudding", price: 6000 },
  ],
  sugars: [
    { id: "100", label: "100%", description: "Rất ngọt" },
    { id: "70", label: "70%", description: "Ngọt vừa" },
    { id: "50", label: "50%", description: "Ít ngọt" },
    { id: "30", label: "30%", description: "Hơi ngọt" },
    { id: "0", label: "0%", description: "Không đường" },
  ],
  iceLevels: [
    { id: "normal", label: "Bình thường", description: "" },
    { id: "less", label: "Ít đá", description: "" },
    { id: "none", label: "Không đá", description: "" },
  ],

  // Chọn sẵn để khớp trạng thái trong ảnh.
  defaultToppingIds: ["pearls", "fruit-jelly"],
  defaultSugarId: "50",
  defaultIceId: "less",
};

const emptyOptions: DishOptions = {
  toppings: [],
  sugars: [],
  iceLevels: [],
  defaultToppingIds: [],
  defaultSugarId: "",
  defaultIceId: "",
};

export function getDishOptions(
  restaurantSlug: string,
  itemId: string,
): DishOptions {
  if (
    restaurantSlug === "tra-sua-nha-lam" &&
    (itemId === "tra-sua-truyen-thong" ||
      itemId === "tra-sua-nha-lam-tra-sua-truyen-thong")
  ) {
    return milkTeaOptions;
  }

  // Không áp dụng tùy chọn trà sữa cho các món khác.
  return emptyOptions;
}

export type FoodExtraDefinition = {
  key: OptionArtworkKind;
  idSuffix: string;
  name: string;
  additional_price: number;
};

export const RICE_FOOD_EXTRAS: readonly FoodExtraDefinition[] = [
  {
    key: "extra-rice",
    idSuffix: "com-them",
    name: "Cơm thêm",
    additional_price: 5000,
  },
  {
    key: "extra-soup",
    idSuffix: "canh-them",
    name: "Canh thêm",
    additional_price: 5000,
  },
  {
    key: "extra-ribs",
    idSuffix: "suon-them",
    name: "Sườn thêm",
    additional_price: 15000,
  },
  {
    key: "extra-egg",
    idSuffix: "trung-them",
    name: "Trứng thêm",
    additional_price: 7000,
  },
  {
    key: "extra-pork-skin",
    idSuffix: "bi-them",
    name: "Bì thêm",
    additional_price: 5000,
  },
  {
    key: "extra-meatloaf",
    idSuffix: "cha-them",
    name: "Chả thêm",
    additional_price: 7000,
  },
  {
    key: "extra-fish-sauce",
    idSuffix: "nuoc-mam-them",
    name: "Nước mắm thêm",
    additional_price: 0,
  },
  {
    key: "extra-cutlery",
    idSuffix: "muong-dua-them",
    name: "Muỗng / đũa thêm",
    additional_price: 0,
  },
] as const;

export function isDrinkDish(
  item: Pick<MenuItemDetail, "category" | "name" | "slug">,
): boolean {
  const cat = (item.category ?? "").toLowerCase();
  if (cat.includes("nước uống") || cat.includes("đồ uống") || cat.includes("trà sữa")) {
    return true;
  }
  const text = `${item.name} ${item.slug}`.toLowerCase();
  return /trà sữa|trà đào|trà tắc|milk tea|cà phê|cafe/.test(text);
}

export function getDisplayCategory(
  item: Pick<MenuItemDetail, "category" | "name" | "slug">,
): string {
  if (isDrinkDish(item)) {
    return "Đồ uống";
  }
  return item.category || "Món chính";
}

const DISH_DESCRIPTIONS: Record<string, string> = {
  "tra-sua-truyen-thong":
    "Trà sữa thơm béo, vị trà đậm đà hòa quyện cùng sữa tươi, là lựa chọn quen thuộc được nhiều bạn yêu thích.",
  "tra-sua-tran-chau":
    "Trà sữa truyền thống kết hợp trân châu đen dẻo mềm, ngọt dịu vừa miệng cho buổi học thêm năng lượng.",
  "tra-dao-cam-sa":
    "Trà đào thanh mát hòa quyện hương sả tự nhiên, cam vàng tươi và miếng đào giòn ngọt giải nhiệt tức thì.",
  "tra-tac":
    "Trà tắc chua ngọt mát lạnh, hương tắc tươi thơm dịu giúp giải khát cực đã sau giờ học.",
  "com-suon-nuong":
    "Cơm trắng dẻo thơm ăn kèm sườn cốt lết nướng mật ong đậm đà, đồ chua giòn ngọt và nước mắm pha chuẩn vị.",
  "com-ga-chien":
    "Cơm nóng hổi dùng kèm đùi gà chiên giòn rụm vàng ươm, dưa leo tươi mát và nước sốt đậm vị sinh viên.",
  "com-tam-bi-cha":
    "Cơm tấm hạt tơi xốp kết hợp bì thính dai giòn, chả trứng hấp mềm béo và nước mắm kẹo chua ngọt.",
  "com-chien-trung":
    "Cơm chiên hạt săn vàng óng quyện trứng gà thơm phức, hành lá xanh tươi và gia vị đậm đà.",
  "com-thit-kho-tau":
    "Thịt ba chỉ kho tàu mềm rục cùng trứng vịt thấm vị nước dừa tươi, ăn kèm cơm nóng và dưa giá chua ngọt.",
  "com-ga-teriyaki":
    "Cơm trắng dẻo mềm phủ gà áp chảo rưới sốt Teriyaki đậm đà kiểu Nhật, kèm salad trộn thanh mát.",
  "com-tam-suon-nuong":
    "Cơm tấm sườn nướng than hoa thơm lừng, thịt mềm mọng nước ăn kèm mỡ hành, đồ chua và nước mắm tỏi ớt.",
};

export function getDishDescription(
  item: Pick<MenuItemDetail, "name" | "slug" | "description">,
): string {
  const genericPattern = `${item.name} — món ăn trong thực đơn của quán.`;
  if (item.description && item.description.trim() !== "" && item.description !== genericPattern) {
    return item.description;
  }

  for (const [key, desc] of Object.entries(DISH_DESCRIPTIONS)) {
    if (item.slug === key || item.slug.endsWith(`-${key}`)) {
      return desc;
    }
  }

  if (isDrinkDish({ category: null, name: item.name, slug: item.slug })) {
    return "Trà sữa thơm béo, vị trà đậm đà hòa quyện cùng sữa tươi, là lựa chọn quen thuộc được nhiều bạn yêu thích.";
  }

  return `${item.name} nóng hổi, chế biến tươi mới mỗi ngày với nguyên liệu sạch, phù hợp khẩu vị sinh viên.`;
}

export function getOptionGroupKind(
  group: Pick<MenuOptionGroupDetail, "name" | "is_multiple">,
): OptionGroupKind {
  const normalized = group.name.toLowerCase();
  if (normalized.includes("topping")) return "topping";
  if (normalized.includes("món thêm") || normalized.includes("ăn kèm")) {
    return "food-extra";
  }
  if (normalized.includes("đường") || normalized.includes("ngọt")) return "sugar";
  if (normalized.includes("đá")) return "ice";
  return group.is_multiple ? "food-extra" : "other";
}

export function getOptionGroupSubtitle(
  group: Pick<MenuOptionGroupDetail, "name" | "is_required" | "is_multiple">,
): string {
  const kind = getOptionGroupKind(group);
  if (kind === "topping") {
    return "Chọn thêm topping yêu thích (có thể chọn nhiều)";
  }
  if (kind === "food-extra") {
    return "Chọn thêm món ăn kèm yêu thích (có thể chọn nhiều)";
  }
  if (kind === "sugar") {
    return "Chọn độ ngọt phù hợp với khẩu vị của bạn";
  }
  if (kind === "ice") {
    return "Chọn lượng đá phù hợp";
  }
  return `${group.is_required ? "Bắt buộc" : "Không bắt buộc"} · ${
    group.is_multiple ? "Có thể chọn nhiều" : "Chọn một"
  }`;
}

export function parseSugarOptionLabel(optionName: string): {
  percentLabel: string;
  tasteLabel: string;
} {
  const trimmed = optionName.trim();
  const match = trimmed.match(/^(\d+%)/);
  const percent = match ? match[1] : trimmed;

  switch (percent) {
    case "100%":
      return { percentLabel: "100%", tasteLabel: "Rất ngọt" };
    case "70%":
      return { percentLabel: "70%", tasteLabel: "Ngọt vừa" };
    case "50%":
      return { percentLabel: "50%", tasteLabel: "Ít ngọt" };
    case "30%":
      return { percentLabel: "30%", tasteLabel: "Hơi ngọt" };
    case "0%":
      return { percentLabel: "0%", tasteLabel: "Không đường" };
    default:
      return { percentLabel: percent, tasteLabel: "Tùy chỉnh" };
  }
}

export function getOptionArtworkKind(optionName: string): OptionArtworkKind {
  const lower = optionName.toLowerCase();
  if (lower.includes("trân châu")) return "pearls";
  if (lower.includes("thạch")) return "fruit-jelly";
  if (lower.includes("pudding") || lower.includes("flan")) return "pudding";
  if (lower.includes("cơm thêm") || lower === "cơm") return "extra-rice";
  if (lower.includes("canh")) return "extra-soup";
  if (lower.includes("sườn")) return "extra-ribs";
  if (lower.includes("trứng") || lower.includes("ốp la")) return "extra-egg";
  if (lower.includes("bì")) return "extra-pork-skin";
  if (lower.includes("chả")) return "extra-meatloaf";
  if (lower.includes("nước mắm") || lower.includes("mắm")) return "extra-fish-sauce";
  if (lower.includes("muỗng") || lower.includes("đũa")) return "extra-cutlery";
  return "generic";
}

export function buildFoodExtraOptionGroup(
  menuItemId: string,
): MenuOptionGroupDetail {
  const groupId = `food-extra-group-${menuItemId}`;
  const options: MenuOption[] = RICE_FOOD_EXTRAS.map((extra) => ({
    id: `food-opt-${extra.idSuffix}-${menuItemId}`,
    group_id: groupId,
    option_name: extra.name,
    additional_price: extra.additional_price,
    is_active: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  }));

  return {
    id: groupId,
    menu_item_id: menuItemId,
    name: "Món thêm",
    is_required: false,
    is_multiple: true,
    is_active: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    options,
  };
}

export function buildDrinkOptionGroups(
  menuItemId: string,
): MenuOptionGroupDetail[] {
  const toppingGroupId = `drink-topping-group-${menuItemId}`;
  const sugarGroupId = `drink-sugar-group-${menuItemId}`;
  const iceGroupId = `drink-ice-group-${menuItemId}`;

  return [
    {
      id: toppingGroupId,
      menu_item_id: menuItemId,
      name: "Topping thêm",
      is_required: false,
      is_multiple: true,
      is_active: true,
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
      options: [
        {
          id: `drink-opt-pearls-${menuItemId}`,
          group_id: toppingGroupId,
          option_name: "Trân châu đen",
          additional_price: 5000,
          is_active: true,
          created_at: CREATED_AT,
          updated_at: CREATED_AT,
        },
        {
          id: `drink-opt-jelly-${menuItemId}`,
          group_id: toppingGroupId,
          option_name: "Thạch trái cây",
          additional_price: 4000,
          is_active: true,
          created_at: CREATED_AT,
          updated_at: CREATED_AT,
        },
        {
          id: `drink-opt-pudding-${menuItemId}`,
          group_id: toppingGroupId,
          option_name: "Pudding",
          additional_price: 6000,
          is_active: true,
          created_at: CREATED_AT,
          updated_at: CREATED_AT,
        },
      ],
    },
    {
      id: sugarGroupId,
      menu_item_id: menuItemId,
      name: "Mức đường",
      is_required: true,
      is_multiple: false,
      is_active: true,
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
      options: [
        ["100", "100% đường"],
        ["70", "70% đường"],
        ["50", "50% đường"],
        ["30", "30% đường"],
        ["0", "0% đường"],
      ].map(([code, label]) => ({
        id: `drink-opt-sugar-${code}-${menuItemId}`,
        group_id: sugarGroupId,
        option_name: label,
        additional_price: 0,
        is_active: true,
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
      })),
    },
    {
      id: iceGroupId,
      menu_item_id: menuItemId,
      name: "Mức đá",
      is_required: true,
      is_multiple: false,
      is_active: true,
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
      options: [
        ["normal", "Bình thường"],
        ["less", "Ít đá"],
        ["none", "Không đá"],
      ].map(([code, label]) => ({
        id: `drink-opt-ice-${code}-${menuItemId}`,
        group_id: iceGroupId,
        option_name: label,
        additional_price: 0,
        is_active: true,
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
      })),
    },
  ];
}

export function resolveDishOptionGroups(
  item: MenuItemDetail,
): MenuOptionGroupDetail[] {
  const activeDbGroups = item.option_groups
    .filter((group) => group.is_active)
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => option.is_active),
    }))
    .filter((group) => group.options.length > 0);

  if (activeDbGroups.length > 0) {
    return activeDbGroups;
  }

  if (isDrinkDish(item)) {
    return buildDrinkOptionGroups(item.id);
  }

  return [buildFoodExtraOptionGroup(item.id)];
}

export function getDefaultSelectedOptions(
  item: Pick<MenuItemDetail, "id" | "slug" | "name" | "category">,
  groups: readonly MenuOptionGroupDetail[],
  defaultSelectedIds?: readonly string[],
): SelectedOption[] {
  if (defaultSelectedIds && defaultSelectedIds.length > 0) {
    const validIds = new Set(
      groups.flatMap((g) => g.options.map((o) => o.id)),
    );
    return defaultSelectedIds
      .filter((id) => validIds.has(id))
      .map((option_id) => ({ option_id }));
  }

  const picked: SelectedOption[] = [];
  const isMockupMilkTea =
    item.slug === "tra-sua-truyen-thong" ||
    item.slug.endsWith("-tra-sua-truyen-thong") ||
    item.id === "20000000-0000-4000-8000-000000000012";

  for (const group of groups) {
    const kind = getOptionGroupKind(group);

    if (kind === "topping" && isMockupMilkTea) {
      for (const option of group.options) {
        const lower = option.option_name.toLowerCase();
        if (lower.includes("trân châu đen") || lower.includes("thạch trái cây")) {
          picked.push({ option_id: option.id });
        }
      }
    } else if (kind === "sugar") {
      const fifty =
        group.options.find((o) => o.option_name.startsWith("50%")) ??
        group.options[0];
      if (fifty) {
        picked.push({ option_id: fifty.id });
      }
    } else if (kind === "ice") {
      const lessIce =
        group.options.find((o) => o.option_name.toLowerCase().includes("ít đá")) ??
        group.options[0];
      if (lessIce) {
        picked.push({ option_id: lessIce.id });
      }
    }
  }

  return picked;
}

export function getDishInfoBannerText(
  item: Pick<MenuItemDetail, "category" | "name" | "slug">,
  groups: readonly MenuOptionGroupDetail[],
): string {
  if (isDrinkDish(item)) {
    return "Hãy chọn topping, mức đường, mức đá và số lượng trước khi thêm vào giỏ hàng nhé!";
  }
  if (groups.some((g) => getOptionGroupKind(g) === "food-extra")) {
    return "Hãy chọn món thêm và số lượng trước khi thêm vào giỏ hàng nhé!";
  }
  return "Hãy chọn tùy chọn và số lượng trước khi thêm vào giỏ hàng nhé!";
}

// Dữ liệu mẫu chuẩn cho màn hình đồ uống (Trà sữa truyền thống - Trà Sữa Nhà Làm)
export const previewDrinkRestaurant: RestaurantPublic =
  mockRestaurants.find((r) => r.slug === "tra-sua-nha-lam") ?? mockRestaurants[1];

export const previewDrinkItem: MenuItemDetail = (() => {
  const base =
    mockMenuItemDetails.find(
      (m) => m.slug === "tra-sua-nha-lam-tra-sua-truyen-thong",
    ) ?? mockMenuItemDetails[11];

  return {
    ...base,
    description: getDishDescription(base),
  };
})();

// Dữ liệu mẫu chuẩn cho màn hình đồ ăn quán cơm (Cơm sườn nướng - Cơm Cô Ba)
export const previewFoodRestaurant: RestaurantPublic =
  mockRestaurants.find((r) => r.slug === "com-co-ba") ?? mockRestaurants[0];

export const previewFoodItem: MenuItemDetail = (() => {
  const base =
    mockMenuItemDetails.find(
      (m) => m.slug === "com-co-ba-com-suon-nuong",
    ) ?? mockMenuItemDetails[1];

  return {
    ...base,
    description: getDishDescription(base),
    option_groups: [buildFoodExtraOptionGroup(base.id)],
  };
})();
