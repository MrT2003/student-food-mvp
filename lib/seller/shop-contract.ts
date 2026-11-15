// Only a saved slug forms a public route; never manufacture a demo URL.
export function restaurantPath(slug: unknown): string | null {
  if (typeof slug !== "string" || !slug.trim() || slug !== slug.trim() ||
      slug === "." || slug === ".." || /[\\/\x00-\x1f]/.test(slug)) return null;
  return `/restaurants/${encodeURIComponent(slug)}`;
}
export function restaurantUrl(slug: unknown, origin: string): string | null {
  const path = restaurantPath(slug);
  if (!path) return null;
  try {
    const base = new URL(origin);
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) return null;
    return new URL(path, base.origin).href;
  } catch { return null; }
}
// Same international format as AuthServices, but this is a separate shop field.
// Omitted PATCH keeps its value; null/blank explicitly clears an optional contact.
export function contactPhone(value: unknown): string | null {
  if (value === null || (typeof value === "string" && !value.trim())) return null;
  if (typeof value !== "string" || !/^\+?\d{9,15}$/.test(value.trim()))
    throw Error("Số liên hệ phải gồm 9–15 chữ số, có thể bắt đầu bằng +.");
  return value.trim();
}
