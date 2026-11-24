import { useAuthStore } from "@/store/useAuthStore";
export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
}
export interface CloudinaryUploadOptions {
  purpose: "avatar" | "restaurant" | "restaurant_registration" | "menu";
  restaurantId?: string;
}
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
async function uploadApi(body: object) {
  const response = await fetch("/api/uploads/cloudinary", { method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Không thể xử lý upload ảnh.");
  return data;
}
export const CloudinaryService = {
  validateImageFile(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) return "Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP.";
    if (!file.size || file.size > MAX_FILE_SIZE_BYTES) return "Ảnh phải có dung lượng lớn hơn 0 và không vượt quá 5MB.";
    return null;
  },
  async uploadImage(file: File, options: CloudinaryUploadOptions): Promise<CloudinaryUploadResult> {
    const validationError = this.validateImageFile(file);
    if (validationError) throw new Error(validationError);
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error("Vui lòng đăng nhập trước khi tải ảnh.");
    const checkAccount = () => {
      if (useAuthStore.getState().user?.id !== userId) throw new Error("Tài khoản đã thay đổi. Vui lòng chọn ảnh lại.");
    };
    // 1. Backend xác minh quyền và cấp đúng tham số đã ký; không gửi file qua Vercel.
    const ticket = await uploadApi({ action: "sign", ...options, size: file.size, mime: file.type });
    checkAccount();
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", ticket.apiKey);
    form.append("signature", ticket.signature);
    for (const [key, value] of Object.entries(ticket.params)) form.append(key, String(value));
    // 2. Browser upload thẳng. Secret không bao giờ có trong ticket hoặc bundle client.
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(ticket.cloudName)}/image/upload`, {
      method: "POST", body: form, signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error("Cloudinary từ chối ảnh. Kiểm tra định dạng, dung lượng hoặc cấu hình preset.");
    checkAccount();
    // 3. Server tự đọc metadata từ Cloudinary. Không dùng secure_url do browser khai để lưu DB.
    const verified = await uploadApi({ action: "complete", intentId: ticket.intentId });
    checkAccount();
    return verified as CloudinaryUploadResult;
  },
};
