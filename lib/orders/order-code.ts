// Display codes are separate from UUID primary keys. Pad widths are minimums;
// sequences never wrap at 1000 or 10000.
export function formatOrderCode(restaurantNumber: number, sequence: number): string {
  if (![restaurantNumber, sequence].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new Error("Số quán và số đơn phải là số nguyên dương.");
  }
  return `SF-${String(restaurantNumber).padStart(2, "0")}-${String(sequence).padStart(4, "0")}`;
}

export function formatTransferContent(orderCode: string, restaurantName: string): string {
  const name = restaurantName.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim().toUpperCase();
  return `${orderCode.replace(/^#/, "").replace(/-/g, "")} - ${name}`;
}
