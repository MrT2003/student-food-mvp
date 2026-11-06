import { isRecord } from "@/utilities/system.utility";
export const MENU_LIMITS = { body: 131072, groups: 20, options: 50, price: 10000000 } as const;
export class MenuError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
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
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new MenuError("VALIDATION_ERROR");
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
  const body = object(input, ["expected_updated_at", "name", "description", "category", "image_url", "price", "is_active", "is_available", "groups"]);
  let expected: string | undefined;
  if (update) {
    if (typeof body.expected_updated_at !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.expected_updated_at) || !Number.isFinite(Date.parse(body.expected_updated_at))) throw new MenuError("VALIDATION_ERROR");
    expected = body.expected_updated_at;
  } else if ("expected_updated_at" in body) throw new MenuError("VALIDATION_ERROR");
  const keys = Object.keys(body).filter(k => k !== "expected_updated_at");
  if (update && keys.length === 1 && ["is_active", "is_available"].includes(keys[0])) return { expected, payload: { [keys[0]]: flag(body[keys[0]]) } };
  const image = text(body.image_url, 2048, true);
  if (image && (!image.startsWith("https://") || (() => { try { return !!new URL(image).username || !!new URL(image).password; } catch { return true; } })())) throw new MenuError("VALIDATION_ERROR");
  if (!Array.isArray(body.groups) || body.groups.length > MENU_LIMITS.groups) throw new MenuError("VALIDATION_ERROR");
  const ids = new Set<string>(), names = new Set<string>();
  const groups = body.groups.map(raw => {
    const g = object(raw, ["id", "name", "is_active", "is_multiple", "is_required", "options"]);
    const id = menuUuid(g.id), name = text(g.name, 80)!;
    if (ids.has(id) || names.has(name.toLowerCase())) throw new MenuError("VALIDATION_ERROR");
    ids.add(id); names.add(name.toLowerCase());
    if (!Array.isArray(g.options) || g.options.length > MENU_LIMITS.options) throw new MenuError("VALIDATION_ERROR");
    const optionNames = new Set<string>();
    const options = g.options.map(rawOption => {
      const o = object(rawOption, ["id", "option_name", "additional_price", "is_active"]);
      const oid = menuUuid(o.id), label = text(o.option_name, 80)!;
      if (ids.has(oid) || optionNames.has(label.toLowerCase())) throw new MenuError("VALIDATION_ERROR");
      ids.add(oid); optionNames.add(label.toLowerCase());
      return { id: oid, option_name: label, additional_price: price(o.additional_price), is_active: flag(o.is_active) };
    });
    const active = flag(g.is_active);
    if (active && !options.some(o => o.is_active)) throw new MenuError("VALIDATION_ERROR");
    return { id, name, is_active: active, is_multiple: flag(g.is_multiple), is_required: flag(g.is_required), options };
  });
  return { expected, payload: { name: text(body.name, 120), description: text(body.description, 160, true), category: text(body.category, 80), image_url: image, price: price(body.price), is_active: flag(body.is_active), is_available: flag(body.is_available), groups } };
}
