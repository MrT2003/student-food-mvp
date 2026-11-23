/** Chỉ tối ưu lúc render; không dùng URL này để ghi lại database/registry upload. */
export function cloudinaryDeliveryUrl(source: string): string {
  try {
    const url = new URL(source);
    // Không đổi ảnh local/blob/data, Google/Zalo, URL có token hoặc delivery riêng tư.
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.port || url.username || url.password || url.search || url.hash) return source;
    const match = url.pathname.match(/^\/([a-zA-Z0-9_-]+)\/image\/upload\/(.+)$/);
    if (!match) return source;
    const rest = match[2];
    const first = rest.split("/")[0];
    // Giữ nguyên URL đã ký hoặc đã có transformation để không phá chữ ký/chất lượng chủ đích.
    if (first.startsWith("s--") || first.includes(",") || /^(?:f|q|c|w|h|t|ar|g|e|fl|dpr)_/.test(first)) return source;
    url.pathname = `/${match[1]}/image/upload/f_auto,q_auto/${rest}`;
    return url.href;
  } catch {
    return source;
  }
}
