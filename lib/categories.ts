export const MASTER_CATEGORIES = [
  "Cơm",
  "Bún/Phở/Mì",
  "Ăn vặt",
  "Trà sữa & Nước",
  "Bánh mì / Ăn nhẹ",
  "Khác",
] as const;

export type MasterCategory = (typeof MASTER_CATEGORIES)[number];

export const CATEGORY_EMOJI: Record<MasterCategory, string> = {
  "Cơm": "🍚",
  "Bún/Phở/Mì": "🍜",
  "Ăn vặt": "🍢",
  "Trà sữa & Nước": "🧋",
  "Bánh mì / Ăn nhẹ": "🥖",
  "Khác": "🍴",
};

export function formatCategoryLabel(category: MasterCategory): string {
  return `${CATEGORY_EMOJI[category]} ${category}`;
}

export function isMasterCategory(value: string): value is MasterCategory {
  return (MASTER_CATEGORIES as readonly string[]).includes(value);
}

export function isDrinkCategory(category?: string | null): boolean {
  if (!category) return false;
  return (
    category === "Trà sữa & Nước" ||
    /trà sữa|đồ uống|nước uống|trà|cà phê|cafe|coffee/i.test(category)
  );
}

/**
 * Chuẩn hóa dữ liệu danh mục từ DB (bao gồm dữ liệu cũ như "Đồ uống", "Nước uống",
 * "Món chính", "Món thêm", "Món Hàn", "Món Việt"...) về đúng 1 trong 6 Master Categories.
 */
export function normalizeMasterCategory(
  rawCategory?: string | null,
  itemName?: string | null,
): MasterCategory {
  const trimmed = rawCategory?.trim() ?? "";
  if (isMasterCategory(trimmed)) {
    return trimmed;
  }

  const normalizedCategory = trimmed.toLowerCase();
  const normalizedName = (itemName ?? "").trim().toLowerCase();

  // Ưu tiên kiểm tra theo tên danh mục cũ nếu không phải danh mục chung chung ("món chính", "món thêm", "món việt")
  const isGenericCategory =
    !normalizedCategory ||
    normalizedCategory === "món chính" ||
    normalizedCategory === "món thêm" ||
    normalizedCategory === "món phụ" ||
    normalizedCategory === "món việt";

  const source = isGenericCategory
    ? `${normalizedName} ${normalizedCategory}`
    : `${normalizedCategory} ${normalizedName}`;

  if (
    /trà sữa|nước uống|đồ uống|trà đào|trà tắc|trà chanh|trà|cà phê|cafe|coffee|sinh tố|nước ép|nước ngọt|sữa tươi/.test(
      source,
    )
  ) {
    return "Trà sữa & Nước";
  }

  if (
    /bánh mì|xôi|hamburger|burger|sandwich|ăn nhẹ|đồ ăn nhanh|fast food/.test(
      source,
    )
  ) {
    return "Bánh mì / Ăn nhẹ";
  }

  if (
    /bún|phở|mì|hủ tiếu|miến|bánh canh|món nước|nước lèo|món hàn|cháo|súp/.test(
      source,
    )
  ) {
    return "Bún/Phở/Mì";
  }

  if (
    /ăn vặt|đồ chiên|đồ nướng|xiên|khoai tây|bánh tráng|cá viên|gà rán|nem nướng|gỏi cuốn|chả giò|phô mai que|bắp xào|cút lộn/.test(
      source,
    )
  ) {
    return "Ăn vặt";
  }

  if (/cơm/.test(source)) {
    return "Cơm";
  }

  return "Khác";
}
