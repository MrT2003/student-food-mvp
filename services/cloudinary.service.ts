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
const SKIP_COMPRESS_BYTES = 250 * 1024;

async function computeFileHash(file: File): Promise<string | null> {
  if (
    typeof crypto === "undefined" ||
    typeof crypto.subtle?.digest !== "function" ||
    typeof file?.arrayBuffer !== "function"
  ) {
    return null;
  }
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

async function decodeImageDimensions(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
} | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback sang HTMLImageElement nếu trình duyệt không decode qua ImageBitmap được
    }
  }
  if (typeof Image === "undefined" || typeof URL === "undefined") return null;
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
      element.src = objectUrl;
    });
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    return null;
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

async function compressImageFile(
  file: File,
  purpose: CloudinaryUploadOptions["purpose"],
): Promise<File> {
  if (typeof document === "undefined" || typeof file?.arrayBuffer !== "function") {
    return file;
  }
  const maxDimension = purpose === "avatar" ? 512 : 1200;
  const decoded = await decodeImageDimensions(file);
  if (!decoded || decoded.width <= 0 || decoded.height <= 0) {
    decoded?.cleanup();
    return file;
  }

  try {
    const longestSide = Math.max(decoded.width, decoded.height);
    if (file.size <= SKIP_COMPRESS_BYTES && longestSide <= maxDimension) {
      return file;
    }

    const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
    const targetWidth = Math.max(1, Math.round(decoded.width * scale));
    const targetHeight = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    decoded.draw(ctx, targetWidth, targetHeight);

    let blob = await canvasToBlob(canvas, "image/webp", 0.82);
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
    }
    if (!blob || blob.size <= 0 || blob.size >= file.size) {
      return file;
    }

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.${ext}`, {
      type: blob.type,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    decoded.cleanup();
  }
}

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

    const [fileHash, prepared] = await Promise.all([
      computeFileHash(file),
      compressImageFile(file, options.purpose),
    ]);
    checkAccount();

    const preparedError = this.validateImageFile(prepared);
    const uploadTarget = preparedError ? file : prepared;

    // 1. Backend xác minh quyền, kiểm tra ảnh trùng và cấp chữ ký upload; không gửi file qua Vercel.
    const ticket = await uploadApi({
      action: "sign",
      ...options,
      size: uploadTarget.size,
      mime: uploadTarget.type,
      ...(fileHash ? { fileHash } : {}),
    });
    checkAccount();
    if (ticket.reused === true && ticket.result?.secureUrl) {
      return ticket.result as CloudinaryUploadResult;
    }

    const form = new FormData();
    form.append("file", uploadTarget);
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
