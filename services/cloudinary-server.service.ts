import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export class UploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_HEX = /^[0-9a-f]{64}$/i;
const purposes = ["avatar", "restaurant", "restaurant_registration", "menu"];
export function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const secret = process.env.CLOUDINARY_API_SECRET?.trim();
  const preset = process.env.CLOUDINARY_SIGNED_UPLOAD_PRESET?.trim();
  if (!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName) || !apiKey || !secret || !preset) throw new UploadError("Chưa cấu hình Cloudinary signed upload trên server.", 503);
  return { cloudName, apiKey, secret, preset };
}
// Cloudinary ký chuỗi tham số sắp xếp + secret (không phải HMAC).
export function signUpload(params: Record<string, string>, secret: string) {
  return createHash("sha256").update(Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&") + secret).digest("hex");
}
async function authorize(userId: string, purpose: string, restaurantId: string | null) {
  const admin = createAdminClient();
  const profile = await admin.from("users").select("role,status,work_for_restaurant_id").eq("id", userId).maybeSingle();
  if (profile.error) throw new UploadError("Chưa kiểm tra được quyền upload.", 503);
  if (profile.data?.status !== "active") throw new UploadError("Tài khoản không có quyền upload.", 403);
  if (purpose === "avatar") return;
  if (purpose === "restaurant_registration") {
    if (profile.data.role !== "student" || profile.data.work_for_restaurant_id) throw new UploadError("Không đủ điều kiện đăng ký quán.", 403);
    const owned = await admin.from("restaurants").select("id").eq("owner_id", userId).limit(1);
    if (owned.error) throw new UploadError("Chưa kiểm tra được cửa hàng.", 503);
    if (owned.data?.length) throw new UploadError("Tài khoản đã có cửa hàng.", 403);
    return;
  }
  if (profile.data.role !== "seller" || !restaurantId || !UUID.test(restaurantId)) throw new UploadError("Chỉ chủ quán được tải ảnh quán/món.", 403);
  const shop = await admin.from("restaurants").select("id").eq("id", restaurantId).eq("owner_id", userId).maybeSingle();
  if (shop.error) throw new UploadError("Chưa kiểm tra được cửa hàng.", 503);
  if (!shop.data) throw new UploadError("Không có quyền upload cho quán này.", 403);
}
export async function issueUpload(userId: string, input: Record<string, unknown>) {
  const config = cloudinaryConfig();
  if (typeof input.purpose !== "string" || !purposes.includes(input.purpose)) throw new UploadError("Mục đích upload không hợp lệ.");
  if (!Number.isInteger(input.size) || Number(input.size) <= 0 || Number(input.size) > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(String(input.mime))) throw new UploadError("Chỉ nhận JPG, PNG, WEBP tối đa 5MB.");
  const restaurantId = ["menu", "restaurant"].includes(input.purpose) && typeof input.restaurantId === "string" ? input.restaurantId : null;
  const fileHash = typeof input.fileHash === "string" && SHA256_HEX.test(input.fileHash.trim()) ? input.fileHash.trim().toLowerCase() : null;
  await authorize(userId, input.purpose, restaurantId);
  const admin = createAdminClient();
  if (fileHash) {
    let dedupeQuery = admin
      .from("cloudinary_uploads")
      .select("id, metadata, verified_url")
      .eq("user_id", userId)
      .eq("purpose", input.purpose)
      .eq("file_hash", fileHash)
      .not("verified_url", "is", null)
      .order("verified_at", { ascending: false })
      .limit(1);
    dedupeQuery = restaurantId
      ? dedupeQuery.eq("restaurant_id", restaurantId)
      : dedupeQuery.is("restaurant_id", null);
    const existing = await dedupeQuery;
    if (!existing.error && existing.data?.[0]?.metadata) {
      return { reused: true, result: existing.data[0].metadata };
    }
  }
  const reserved = await admin.rpc("reserve_cloudinary_upload", { p_user_id: userId, p_purpose: input.purpose, p_restaurant_id: restaurantId });
  if (reserved.error) {
    if (reserved.error.message.includes("UPLOAD_RATE_LIMIT")) throw new UploadError("Đã đạt giới hạn 20 lượt/giờ hoặc 100 lượt/ngày. Vui lòng thử lại sau.", 429);
    throw new UploadError("Chưa cấp được quyền upload. Kiểm tra migration Cloudinary.", 503);
  }
  if (fileHash && reserved.data?.id) {
    await admin.from("cloudinary_uploads").update({ file_hash: fileHash }).eq("id", reserved.data.id);
  }
  const params = { timestamp: String(Math.floor(Date.now() / 1000)), public_id: reserved.data.public_id as string,
    upload_preset: config.preset, overwrite: "false", allowed_formats: "jpg,png,webp" };
  return { intentId: reserved.data.id, cloudName: config.cloudName, apiKey: config.apiKey, params, signature: signUpload(params, config.secret) };
}
export async function completeUpload(userId: string, intentId: unknown) {
  if (typeof intentId !== "string" || !UUID.test(intentId)) throw new UploadError("Lượt upload không hợp lệ.");
  const admin = createAdminClient();
  const result = await admin.from("cloudinary_uploads").select("*").eq("id", intentId).eq("user_id", userId).maybeSingle();
  if (result.error) throw new UploadError("Chưa đọc được lượt upload.", 503);
  const intent = result.data;
  if (!intent) throw new UploadError("Không tìm thấy lượt upload của bạn.", 404);
  await authorize(userId, intent.purpose, intent.restaurant_id);
  if (intent.verified_url) return intent.metadata;
  if (Date.now() - Date.parse(intent.created_at) > 3600000) throw new UploadError("Lượt upload đã hết hạn. Vui lòng chọn ảnh lại.", 410);
  // Không để spam complete tiêu hết quota Admin API: tối đa một lần/30s mỗi intent.
  const now = new Date();
  const claimed = await admin.from("cloudinary_uploads").update({ verify_after: new Date(now.getTime() + 30000).toISOString() })
    .eq("id", intentId).eq("user_id", userId).is("verified_url", null).lte("verify_after", now.toISOString()).select("id").maybeSingle();
  if (claimed.error) throw new UploadError("Chưa thể xác minh ảnh.", 503);
  if (!claimed.data) throw new UploadError("Ảnh đang được xác minh. Vui lòng thử lại sau 30 giây.", 429);
  const config = cloudinaryConfig();
  // Không tin URL/size/format từ browser. Đọc asset bằng public_id đã do server cấp.
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload/${encodeURIComponent(intent.public_id)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.secret}`).toString("base64")}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new UploadError("Chưa xác minh được ảnh với Cloudinary. Vui lòng thử lại.", 503);
  const asset = await response.json();
  if (asset.public_id !== intent.public_id || asset.resource_type !== "image" || asset.type !== "upload" || !["jpg", "png", "webp"].includes(asset.format) || !Number.isInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > 5 * 1024 * 1024 || !Number.isInteger(asset.version) || asset.version <= 0) throw new UploadError("Ảnh không đạt giới hạn định dạng hoặc dung lượng.");
  // Tạo URL chuẩn từ dữ liệu đáng tin, không nhận URL bất kỳ từ client.
  const secureUrl = `https://res.cloudinary.com/${config.cloudName}/image/upload/v${asset.version}/${intent.public_id}.${asset.format}`;
  const verified = { secureUrl, publicId: intent.public_id, width: asset.width, height: asset.height, format: asset.format };
  const saved = await admin.from("cloudinary_uploads").update({ verified_url: secureUrl, verified_at: new Date().toISOString(), metadata: verified }).eq("id", intentId).eq("user_id", userId);
  if (saved.error) throw new UploadError("Chưa lưu được kết quả xác minh ảnh.", 503);
  return verified;
}

