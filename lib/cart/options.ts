import type { SelectedOption } from "@/types/cart.types";
import type { OptionSnapshot } from "@/types/order.types";
import type { MenuItemDetail } from "@/types/restaurant.types";

export function normalizeSelectedOptions(
  selected: readonly SelectedOption[],
): SelectedOption[] {
  return [...new Set(selected.map((item) => item.option_id))]
    .sort()
    .map((option_id) => ({ option_id }));
}

// Khóa ổn định để gộp cùng món + cùng bộ tùy chọn.
// Đây là quy ước frontend/mock; backend phải dùng cùng quy ước
// hoặc trả lại khóa chuẩn của backend khi tích hợp.
export function createOptionHash(selected: readonly SelectedOption[]): string {
  const ids = normalizeSelectedOptions(selected).map((item) => item.option_id);

  return ids.length === 0 ? "no_option" : JSON.stringify(ids);
}

// Hàm này phục vụ tính giá dự kiến và mock.
// Khi checkout thật, backend phải tự kiểm tra và tạo snapshot.
export function resolveSelectedOptions(
  menuItem: MenuItemDetail,
  selected: readonly SelectedOption[],
): OptionSnapshot[] {
  const normalized = normalizeSelectedOptions(selected);
  const selectedIds = new Set(normalized.map((item) => item.option_id));

  const resolvedIds = new Set<string>();
  const snapshots: OptionSnapshot[] = [];

  for (const group of menuItem.option_groups) {
    if (!group.is_active) continue;

    if (group.menu_item_id !== menuItem.id) {
      throw new Error("Nhóm tùy chọn không thuộc món ăn.");
    }

    const choices = group.options.filter(
      (option) =>
        option.is_active &&
        option.group_id === group.id &&
        selectedIds.has(option.id),
    );

    if (group.is_required && choices.length === 0) {
      throw new Error(`Vui lòng chọn ${group.name}.`);
    }

    if (!group.is_multiple && choices.length > 1) {
      throw new Error(`${group.name} chỉ cho phép chọn một tùy chọn.`);
    }

    for (const option of choices) {
      if (resolvedIds.has(option.id)) {
        throw new Error("Dữ liệu tùy chọn bị trùng.");
      }

      if (
        !Number.isFinite(option.additional_price) ||
        option.additional_price < 0
      ) {
        throw new Error("Giá tùy chọn không hợp lệ.");
      }

      resolvedIds.add(option.id);

      snapshots.push({
        option_id: option.id,
        group_name: group.name,
        option_name: option.option_name,
        additional_price: option.additional_price,
      });
    }
  }

  if (resolvedIds.size !== selectedIds.size) {
    throw new Error(
      "Có tùy chọn không tồn tại, đã ngừng bán hoặc không thuộc món.",
    );
  }

  return snapshots;
}

export function getEstimatedUnitPrice(
  menuItem: MenuItemDetail,
  selected: readonly SelectedOption[],
): number {
  if (!Number.isFinite(menuItem.price) || menuItem.price < 0) {
    throw new Error("Giá món không hợp lệ.");
  }

  const snapshots = resolveSelectedOptions(menuItem, selected);

  return (
    menuItem.price +
    snapshots.reduce((sum, option) => sum + option.additional_price, 0)
  );
}
