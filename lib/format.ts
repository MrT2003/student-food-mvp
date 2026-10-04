const moneyFormatter = new Intl.NumberFormat("vi-VN");

export function formatMoney(value: number): string {
  return `${moneyFormatter.format(value)}đ`;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}