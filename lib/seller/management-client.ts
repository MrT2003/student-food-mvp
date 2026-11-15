"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { contactPhone } from "./shop-contract";
import { readSellerAccess, invalidateSellerAccess } from "./access-client";
import type { SellerBankListResult, SellerBankResult, SellerBankPatch, SellerRestaurantPatch, SellerRestaurantUpdateResult } from "@/types/seller.types";

const messages: Record<string, string> = {
  UNAUTHORIZED: "Vui lòng đăng nhập lại.",
  ACCOUNT_INACTIVE: "Tài khoản không hoạt động.",
  SELLER_REQUIRED: "Chỉ seller được quản lý cửa hàng.",
  RESTAURANT_NOT_FOUND: "Không tìm thấy cửa hàng thuộc tài khoản của bạn.",
  BANK_NOT_FOUND: "Không tìm thấy tài khoản ngân hàng của cửa hàng này.",
  BANK_ACCOUNT_CONFLICT: "Số tài khoản đã tồn tại trong cửa hàng này.",
  BANK_DEFAULT_ATOMICITY_UNAVAILABLE: "Chưa hỗ trợ chuyển mặc định giữa hai tài khoản vì chưa có cơ chế DB nguyên tử được xác minh. Mặc định hiện tại được giữ nguyên.",
  DATABASE_ACCESS_DENIED: "Database từ chối quyền thao tác. Không có thay đổi quyền tự động.",
  CONTACT_PHONE_UNAVAILABLE: "DB chưa sẵn sàng cho số liên hệ quán. Cần kiểm tra và áp dụng SQL đã review.",
  VALIDATION_ERROR: "Thông tin không hợp lệ. Hãy kiểm tra các trường và lịch hoạt động.",
};

function assertActor(actorId: string) {
  const user = useAuthStore.getState().user;
  if (user?.id !== actorId || user.role !== "seller" || user.status !== "active")
    throw Error("Phiên tài khoản đã thay đổi. Vui lòng tải lại thông tin.");
}

class UncertainSaveError extends Error {}

async function request(actorId: string, path: string, method: "GET" | "POST" | "PATCH", body?: unknown, signal?: AbortSignal) {
  assertActor(actorId);
  let response: Response;
  try {
    response = await fetch(path, { method, credentials: "same-origin", cache: "no-store",
      ...(signal ? { signal } : {}),
      ...(method === "GET" ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  } catch {
    throw new UncertainSaveError(method === "GET" ? "Không tải được dữ liệu. Hãy thử tải lại." : "Chưa xác định kết quả lưu. Hãy tải lại dữ liệu trước khi gửi lại.");
  }
  const data = await response.json().catch(() => null);
  assertActor(actorId); // Không để response cũ xuất hiện khi đổi tài khoản.
  if (!response.ok && data?.error?.code === "VALIDATION_ERROR") {
    // Map a known field to static guidance. Never echo raw DB/upstream messages.
    const fields: Record<string, string> = {
      contact_phone: "Số điện thoại liên hệ: nhập 9–15 chữ số, có thể có một dấu + ở đầu; để trống để xóa.",
      name: "Tên cửa hàng: không được trống, tối đa 100 ký tự.",
      description: "Mô tả: không được trống khi gửi cập nhật, tối đa 300 ký tự.",
      location: "Địa điểm: không được trống khi gửi cập nhật, tối đa 200 ký tự.",
      avatar_url: "Ảnh đại diện: cần URL HTTPS hợp lệ hoặc null để xóa.",
      restaurantId: "Định danh cửa hàng không hợp lệ. Hãy tải lại thông tin quán.",
      payload: "Payload cập nhật có trường ngoài contract hoặc cấu trúc không hợp lệ.",
      schedule: "Lịch hoạt động chưa hợp lệ. Kiểm tra ngày và giờ trong phần Lưu lịch.",
    };
    const field = typeof data.error.field === "string" ? data.error.field :
      typeof data.error.message === "string" ? /^SELLER_VALIDATION_ERROR: ([A-Za-z_]+)(?:[.\[]|:)/.exec(data.error.message)?.[1] : undefined;
    const root = field?.split(/[.\[]/, 1)[0];
    if (root && Object.hasOwn(fields, root)) throw Error(fields[root]);
  }
  if (!response.ok) throw Error(messages[data?.error?.code] ?? "Không thực hiện được yêu cầu. Hãy tải lại dữ liệu trước khi thử lại.");
  return data;
}

const path = (id: string) => `/api/seller/restaurants/${encodeURIComponent(id)}`;

export async function updateSellerRestaurant(actorId: string, restaurantId: string, patch: SellerRestaurantPatch): Promise<SellerRestaurantUpdateResult> {
  let data;
  const controller = Object.hasOwn(patch, "contact_phone") ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), 15000) : undefined;
  try {
    try { data = await request(actorId, path(restaurantId), "PATCH", patch, controller?.signal); }
    finally { if (timer !== undefined) clearTimeout(timer); }
    if (data?.restaurant?.id !== restaurantId || typeof data.restaurant.name !== "string")
      throw new UncertainSaveError("Chưa xác nhận được kết quả lưu. Hãy tải lại dữ liệu trước khi gửi lại.");
    if (Object.hasOwn(patch, "avatar_url") && data.restaurant.avatar_url !== (patch.avatar_url?.trim() ?? null))
      throw new UncertainSaveError("Chưa xác nhận được ảnh đã lưu. Hãy tải lại dữ liệu trước khi gửi lại.");
    if (Object.hasOwn(patch, "contact_phone") && data.restaurant.contact_phone !== contactPhone(patch.contact_phone))
      throw new UncertainSaveError("Chưa xác nhận được số liên hệ đã lưu. Hãy tải lại dữ liệu.");
  } catch (error) {
    // No retry/compensating write after an uncertain contact save; reconcile all
    // submitted info fields, not just the phone, against the owned DB record.
    if (!(error instanceof UncertainSaveError) || !Object.hasOwn(patch, "contact_phone") || patch.schedule) throw error;
    const current = await readSellerAccess().catch(() => null);
    assertActor(actorId);
    const row = current?.restaurant;
    if (current?.user.id !== actorId || current.user.role !== "seller" || current.user.status !== "active" || row?.id !== restaurantId || !row.contact_phone_available)
      throw error;
    for (const field of ["name", "description", "location", "avatar_url", "contact_phone"] as const) {
      if (Object.hasOwn(patch, field) && row[field] !== (field === "contact_phone" ? contactPhone(patch[field]) : patch[field]?.trim() ?? null)) throw error;
    }
    data = { restaurant: row };
  }
  // Menu/sidebar/dashboard cùng tải lại nguồn DB, không sửa tên trong preview store.
  invalidateSellerAccess();
  return data;
}

function bankRow(value: unknown, restaurantId: string): SellerBankResult["bank"] {
  const row = value as SellerBankResult["bank"] | null;
  if (!row || typeof row.id !== "string" || row.restaurant_id !== restaurantId ||
    typeof row.bank_name !== "string" || typeof row.account_no !== "string" ||
    typeof row.account_name !== "string" || typeof row.is_default !== "boolean")
    throw Error("Chưa xác nhận được dữ liệu ngân hàng. Hãy tải lại trước khi thao tác tiếp.");
  return { id: row.id, restaurant_id: row.restaurant_id, bank_name: row.bank_name,
    account_no: row.account_no, account_name: row.account_name, is_default: row.is_default };
}

export async function readSellerBanks(actorId: string, restaurantId: string): Promise<SellerBankListResult> {
  const data = await request(actorId, `${path(restaurantId)}/banks`, "GET");
  if (!Array.isArray(data?.banks)) throw Error("Không tải được danh sách ngân hàng.");
  return { banks: data.banks.map((row: unknown) => bankRow(row, restaurantId)) };
}

export async function saveSellerBank(actorId: string, restaurantId: string, bankId: string | null, patch: SellerBankPatch): Promise<SellerBankResult> {
  const data = await request(actorId, `${path(restaurantId)}/banks${bankId ? `/${encodeURIComponent(bankId)}` : ""}`, bankId ? "PATCH" : "POST", patch);
  const bank = bankRow(data?.bank, restaurantId);
  if (bankId && bank.id !== bankId) throw Error("Chưa xác nhận được tài khoản vừa lưu. Hãy tải lại.");
  return { bank };
}
