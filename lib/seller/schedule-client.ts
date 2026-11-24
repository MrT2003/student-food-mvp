import type { SellerDayId, SellerRegistrationSchedule } from "@/types/seller.types";

export const shopDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type EditableShopDay = { id: SellerDayId; label: string; enabled: boolean; opens: string; closes: string };
const labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
const time = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

// Chỉ nhận quy ước đã chốt. JSON cũ không được tự diễn giải hoặc ghi lại khi sửa tên.
export function readShopSchedule(value: unknown) {
  const days: EditableShopDay[] = shopDays.map((id, i) => ({ id, label: labels[i], enabled: false, opens: "10:00", closes: "14:00" }));
  const fallback = { days, mode: "later" as "same" | "daily" | "later", recognized: value === null };
  if (!record(value) || value.version !== 1 || value.timezone !== "Asia/Ho_Chi_Minh" || !record(value.days)) return fallback;
  const entries = Object.entries(value.days);
  if (!entries.length || entries.some(([id, hours]) => !shopDays.includes(id as SellerDayId) || !record(hours) || !time(hours.open) || !time(hours.close) || hours.open >= hours.close)) return fallback;
  for (const day of days) {
    const hours = value.days[day.id];
    if (record(hours)) { day.enabled = true; day.opens = hours.open as string; day.closes = hours.close as string; }
  }
  const selected = days.filter(day => day.enabled);
  return { days, mode: selected.every(day => day.opens === selected[0].opens && day.closes === selected[0].closes) ? "same" as const : "daily" as const, recognized: true };
}

export function shopSchedulePayload(mode: "same" | "daily" | "later", days: EditableShopDay[], opens: string, closes: string): SellerRegistrationSchedule {
  if (mode === "later") return { mode };
  const selected = days.filter(day => day.enabled);
  if (!selected.length) throw Error("Chọn ít nhất một ngày hoạt động.");
  if (selected.some(day => !time(mode === "same" ? opens : day.opens) || !time(mode === "same" ? closes : day.closes) || (mode === "same" ? opens >= closes : day.opens >= day.closes)))
    throw Error("Giờ phải theo HH:mm và giờ đóng phải sau giờ mở trong cùng ngày.");
  return mode === "same" ? { mode, dayIds: selected.map(day => day.id), openTime: opens, closeTime: closes }
    : { mode, days: selected.map(day => ({ id: day.id, open: day.opens, close: day.closes })) };
}
