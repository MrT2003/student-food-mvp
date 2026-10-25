// Next có thể chuẩn hóa request.url sang hostname nội bộ (localhost).
// Host là đích của HTTP request; không lấy X-Forwarded-Host do client tự khai.
// Reverse proxy phải chuyển tiếp Host/scheme bên ngoài đúng và đáng tin cậy.
export function isSameOrigin(request: Request): boolean {
  try {
    const rawOrigin = request.headers.get("origin");
    if (!rawOrigin || rawOrigin === "null") return false;
    const origin = new URL(rawOrigin);
    if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== rawOrigin) return false;
    const url = new URL(request.url);
    const host = request.headers.get("host") ?? url.host;
    if (!host || /[\s,\/@?#\\]/.test(host)) return false;
    const target = new URL(`${url.protocol}//${host}`);
    return origin.origin === target.origin;
  } catch { return false; }
}
