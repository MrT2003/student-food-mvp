import { isRecord } from "@/utilities/system.utility";
export const MENU_LIMITS = { body: 131072, groups: 20, options: 50, price: 10000000 } as const;
export class MenuError extends Error {
  constructor(public code: string, public status = 400, public issue?: MenuIssue) {
    super(issue ? menuIssueMessage(issue) : code);
  }
}
export type MenuIssue = { field: string; reason: string };
const issueMessages: Record<string, string> = {
  INVALID_OBJECT: "Cấu trúc dữ liệu không hợp lệ hoặc thiếu trường bắt buộc.",
  UNKNOWN_FIELD: "Có trường không được hỗ trợ.",
  INVALID_TEXT: "Nội dung trống, sai kiểu hoặc vượt giới hạn ký tự.",
  INVALID_UUID: "ID không hợp lệ hoặc bị trùng.",
  INVALID_TIMESTAMP: "Phiên bản dữ liệu không hợp lệ. Hãy tải lại món.",
  INVALID_BOOLEAN: "Trạng thái phải là bật hoặc tắt.",
  INVALID_PRICE: "Giá phải từ 0 đến 10.000.000đ, tối đa hai chữ số thập phân.",
  INVALID_URL: "Ảnh phải là URL HTTPS hợp lệ, không chứa tài khoản hoặc mật khẩu.",
  INVALID_GROUPS: "Tối đa 20 nhóm, ID và tên nhóm không được trùng.",
  INVALID_OPTIONS: "Tối đa 50 lựa chọn/nhóm, ID và tên không được trùng; nhóm đang bật cần ít nhất một lựa chọn đang bật.",
  INVALID_OPTION: "Kiểm tra tên (tối đa 80 ký tự), trạng thái và giá của lựa chọn.",
  INVALID_FLAGS: "Trạng thái hiển thị hoặc bán không hợp lệ.",
  PAYLOAD_TOO_LARGE: "Dữ liệu vượt giới hạn 128 KB.",
};
export function parseMenuIssue(value: unknown): MenuIssue | undefined {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return undefined; } }
  if (!isRecord(value) || typeof value.field !== "string" || typeof value.reason !== "string" || !Object.hasOwn(issueMessages, value.reason)) return undefined;
  if (value.field.length > 150 || !/^[a-z_]+(?:\[\d+\])?(?:\.[a-z_]+(?:\[\d+\])?)*$/.test(value.field)) return undefined;
  return { field: value.field, reason: value.reason };
}
export function menuIssueMessage(issue: MenuIssue): string {
  const labels: Record<string, string> = { payload: "Thông tin món", name: "Tên món (tối đa 120 ký tự)", category: "Danh mục (tối đa 80 ký tự)", description: "Mô tả (tối đa 160 ký tự)", image_url: "Ảnh món", price: "Giá bán", expected_updated_at: "Phiên bản món", groups: "Nhóm tùy chọn" };
  const field = labels[issue.field] ?? issue.field.replace(/groups\[(\d+)\]/, (_, n) => `Nhóm ${Number(n) + 1}`).replace(/options\[(\d+)\]/, (_, n) => `lựa chọn ${Number(n) + 1}`);
  return `${field}: ${issueMessages[issue.reason] ?? "Dữ liệu không hợp lệ."}`;
}
function atField<T>(field: string, reason: string, validate: () => T): T {
  try { return validate(); } catch (error) {
    if (error instanceof MenuError && !error.issue) throw new MenuError(error.code, error.status, { field, reason });
    throw error;
  }
}
export function menuUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new MenuError("VALIDATION_ERROR");
  return value.toLowerCase();
}
function object(value: unknown, keys: string[]) {
  if (!isRecord(value) || Object.keys(value).some(key => !keys.includes(key))) throw new MenuError("VALIDATION_ERROR");
  return value;
}
function text(value: unknown, max: number, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !value.trim() || Array.from(value.trim()).length > max) throw new MenuError("VALIDATION_ERROR");
  return value.trim();
}
function flag(value: unknown): boolean {
  if (typeof value !== "boolean") throw new MenuError("VALIDATION_ERROR");
  return value;
}
function price(value: unknown): number {
  // numeric(12,2): accept cents without rounding existing catalog prices.
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MENU_LIMITS.price || Number(value.toFixed(2)) !== value) throw new MenuError("VALIDATION_ERROR");
  return value;
}
export function validateMenu(input: unknown, update: boolean) {
  return atField("payload", "INVALID_OBJECT", () => validateMenuBody(input, update));
}
function validateMenuBody(input: unknown, update: boolean) {
  const body = object(input, ["expected_updated_at", "name", "description", "category", "image_url", "price", "is_active", "is_available", "groups"]);
  if (new TextEncoder().encode(JSON.stringify(body)).length > MENU_LIMITS.body) throw new MenuError("VALIDATION_ERROR", 400, { field: "payload", reason: "PAYLOAD_TOO_LARGE" });
  let expected: string | undefined;
  if (update) {
    if (typeof body.expected_updated_at !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.expected_updated_at) || !Number.isFinite(Date.parse(body.expected_updated_at))) throw new MenuError("VALIDATION_ERROR", 400, { field: "expected_updated_at", reason: "INVALID_TIMESTAMP" });
    expected = body.expected_updated_at;
  } else if ("expected_updated_at" in body) throw new MenuError("VALIDATION_ERROR", 400, { field: "expected_updated_at", reason: "INVALID_TIMESTAMP" });
  const keys = Object.keys(body).filter(k => k !== "expected_updated_at");
  if (update && keys.length === 1 && ["is_active", "is_available"].includes(keys[0])) return { expected, payload: { [keys[0]]: atField(keys[0], "INVALID_BOOLEAN", () => flag(body[keys[0]])) } };
  const image = atField("image_url", "INVALID_URL", () => text(body.image_url, 2048, true));
  if (image && (!image.startsWith("https://") || /\s|\\/.test(image) || (() => { try { const url = new URL(image); return !url.hostname || !!url.username || !!url.password; } catch { return true; } })())) throw new MenuError("VALIDATION_ERROR", 400, { field: "image_url", reason: "INVALID_URL" });
  if (!Array.isArray(body.groups) || body.groups.length > MENU_LIMITS.groups) throw new MenuError("VALIDATION_ERROR", 400, { field: "groups", reason: "INVALID_GROUPS" });
  const ids = new Set<string>(), names = new Set<string>();
  const groups = body.groups.map((raw, gi) => atField(`groups[${gi}]`, "INVALID_GROUPS", () => {
    const g = object(raw, ["id", "name", "is_active", "is_multiple", "is_required", "options"]);
    const id = atField(`groups[${gi}].id`, "INVALID_UUID", () => menuUuid(g.id)), name = atField(`groups[${gi}].name`, "INVALID_TEXT", () => text(g.name, 80))!;
    if (ids.has(id) || names.has(name.toLowerCase())) throw new MenuError("VALIDATION_ERROR");
    ids.add(id); names.add(name.toLowerCase());
    if (!Array.isArray(g.options) || g.options.length > MENU_LIMITS.options) throw new MenuError("VALIDATION_ERROR", 400, { field: `groups[${gi}].options`, reason: "INVALID_OPTIONS" });
    const optionNames = new Set<string>();
    const options = g.options.map((rawOption, oi) => atField(`groups[${gi}].options[${oi}]`, "INVALID_OPTION", () => {
      const o = object(rawOption, ["id", "option_name", "additional_price", "is_active"]);
      const oid = atField(`groups[${gi}].options[${oi}].id`, "INVALID_UUID", () => menuUuid(o.id)), label = atField(`groups[${gi}].options[${oi}].option_name`, "INVALID_TEXT", () => text(o.option_name, 80))!;
      if (ids.has(oid) || optionNames.has(label.toLowerCase())) throw new MenuError("VALIDATION_ERROR");
      ids.add(oid); optionNames.add(label.toLowerCase());
      return { id: oid, option_name: label, additional_price: atField(`groups[${gi}].options[${oi}].additional_price`, "INVALID_PRICE", () => price(o.additional_price)), is_active: flag(o.is_active) };
    }));
    const active = flag(g.is_active);
    if (active && !options.some(o => o.is_active)) throw new MenuError("VALIDATION_ERROR", 400, { field: `groups[${gi}].options`, reason: "INVALID_OPTIONS" });
    return { id, name, is_active: active, is_multiple: flag(g.is_multiple), is_required: flag(g.is_required), options };
  }));
  return { expected, payload: { name: atField("name", "INVALID_TEXT", () => text(body.name, 120)), description: atField("description", "INVALID_TEXT", () => text(body.description, 160, true)), category: atField("category", "INVALID_TEXT", () => text(body.category, 80)), image_url: image, price: atField("price", "INVALID_PRICE", () => price(body.price)), is_active: atField("is_active", "INVALID_BOOLEAN", () => flag(body.is_active)), is_available: atField("is_available", "INVALID_BOOLEAN", () => flag(body.is_available)), groups } };
}
