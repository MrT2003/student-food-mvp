"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { invalidateSellerAccess } from "./access-client";
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
  VALIDATION_ERROR: "Thông tin không hợp lệ. Hãy kiểm tra các trường và lịch hoạt động.",
};

function assertActor(actorId: string) {
  const user = useAuthStore.getState().user;
  if (user?.id !== actorId || user.role !== "seller" || user.status !== "active")
    throw Error("Phiên tài khoản đã thay đổi. Vui lòng tải lại thông tin.");
}

async function request(actorId: string, path: string, method: "GET" | "POST" | "PATCH", body?: unknown) {
  assertActor(actorId);
  let response: Response;
  try {
    response = await fetch(path, { method, credentials: "same-origin", cache: "no-store",
      ...(method === "GET" ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  } catch {
    throw Error(method === "GET" ? "Không tải được dữ liệu. Hãy thử tải lại." : "Chưa xác định kết quả lưu. Hãy tải lại dữ liệu trước khi gửi lại.");
  }
  const data = await response.json().catch(() => null);
  assertActor(actorId); // Không để response cũ xuất hiện khi đổi tài khoản.
  if (!response.ok) throw Error(messages[data?.error?.code] ?? "Không thực hiện được yêu cầu. Hãy tải lại dữ liệu trước khi thử lại.");
  return data;
}

const path = (id: string) => `/api/seller/restaurants/${encodeURIComponent(id)}`;

export async function updateSellerRestaurant(actorId: string, restaurantId: string, patch: SellerRestaurantPatch): Promise<SellerRestaurantUpdateResult> {
  const data = await request(actorId, path(restaurantId), "PATCH", patch);
  if (data?.restaurant?.id !== restaurantId || typeof data.restaurant.name !== "string")
    throw Error("Chưa xác nhận được kết quả lưu. Hãy tải lại dữ liệu trước khi gửi lại.");
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
