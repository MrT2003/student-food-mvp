export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
}

export interface CloudinaryUploadOptions {
  folder?: string;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const CloudinaryService = {
  validateImageFile(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return "Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP.";
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return "Kích thước ảnh không được vượt quá 5MB.";
    }
    return null;
  },

  async uploadImage(
    file: File,
    options?: CloudinaryUploadOptions,
  ): Promise<CloudinaryUploadResult> {
    const validationError = this.validateImageFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Chưa cấu hình NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME hoặc NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET trong .env.local.",
      );
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    if (options?.folder) {
      formData.append("folder", options.folder);
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          secure_url?: string;
          public_id?: string;
          width?: number;
          height?: number;
          format?: string;
          error?: { message?: string };
        }
      | null;

    if (!response.ok || !payload?.secure_url) {
      const detail = payload?.error?.message;
      throw new Error(
        detail
          ? `Upload ảnh lên Cloudinary thất bại: ${detail}`
          : "Không thể tải ảnh lên Cloudinary. Vui lòng thử lại.",
      );
    }

    return {
      secureUrl: payload.secure_url,
      publicId: payload.public_id ?? "",
      width: payload.width,
      height: payload.height,
      format: payload.format,
    };
  },
};
