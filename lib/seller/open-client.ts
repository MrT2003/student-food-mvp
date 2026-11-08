"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { readSellerAccess, invalidateSellerAccess } from "./access-client";

const messages: Record<string, string> = {
  UNAUTHORIZED: "Vui lòng đăng nhập lại.",
  FORBIDDEN: "Yêu cầu mở cửa hàng không hợp lệ.",
  PROFILE_NOT_FOUND: "Chưa có hồ sơ hợp lệ.",
  ACCOUNT_INACTIVE: "Tài khoản không hoạt động.",
  SELLER_REQUIRED: "Chỉ seller được mở cửa hàng của mình.",
  RESTAURANT_NOT_FOUND: "Không tìm thấy cửa hàng thuộc tài khoản của bạn.",
  OPERATING_STATUS_CONFLICT: "Cửa hàng không còn ở trạng thái đóng. Hãy tải lại trạng thái.",
  DATABASE_ACCESS_DENIED: "Database từ chối quyền mở cửa hàng.",
  RESTAURANT_OPEN_RPC_UNAVAILABLE: "Chức năng mở cửa hàng chưa sẵn sàng: cần kiểm tra RPC set_restaurant_operating_status trên DB.",
  RESTAURANT_OPEN_FAILED: "Không mở được cửa hàng. Hãy tải lại trạng thái trước khi thử lại.",
  VALIDATION_ERROR: "Dữ liệu mở cửa hàng không hợp lệ.",
};

function assertActor(actorId: string) {
  const user = useAuthStore.getState().user;
  if (user?.id !== actorId || user.role !== "seller" || user.status !== "active")
    throw Error("Phiên tài khoản đã thay đổi. Vui lòng tải lại.");
}

async function readCurrent(actorId: string, restaurantId: string) {
  assertActor(actorId);
  const data = await readSellerAccess();
  assertActor(actorId);
  if (data.user.id !== actorId || data.user.role !== "seller" || data.user.status !== "active" || data.restaurant?.id !== restaurantId)
    throw Error("Tài khoản hoặc cửa hàng đã thay đổi. Vui lòng tải lại.");
  return data.restaurant;
}

export async function openSellerRestaurant(actorId: string, restaurantId: string) {
  // Đọc trước mỗi lần thử, kể cả sau timeout: không retry mù một mutation cũ.
  const before = await readCurrent(actorId, restaurantId);
  if (before.operating_status === "open") {
    invalidateSellerAccess();
    return { alreadyOpen: true, recovered: false };
  }
  if (before.operating_status !== "closed") throw Error(messages.OPERATING_STATUS_CONFLICT);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let data: unknown;
  let response: Response | undefined;
  try {
    response = await fetch(`/api/seller/restaurants/${encodeURIComponent(restaurantId)}/open`, {
      method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operating_status: "open" }),
    });
    data = await response.json();
  } catch {
    // Timeout/parse/network có thể xảy ra sau commit; chỉ đọc lại, không POST lại.
  } finally { clearTimeout(timer); }
  assertActor(actorId);
  const result = data as { restaurant?: { id?: string; operating_status?: string }; alreadyOpen?: boolean; error?: { code?: string } } | undefined;
  if (response && !response.ok && result?.error?.code && messages[result.error.code])
    throw Error(messages[result.error.code]);
  const confirmedResponse = response?.ok === true && result?.restaurant?.id === restaurantId &&
    result.restaurant.operating_status === "open" && typeof result.alreadyOpen === "boolean";
  let current;
  try { current = await readCurrent(actorId, restaurantId); }
  catch {
    throw Error("Chưa xác nhận được kết quả mở. Hãy tải lại trạng thái trước khi thử lại.");
  }
  // Context vẫn chỉ hiển thị dữ liệu GET từ DB, không gán operating_status ở client.
  invalidateSellerAccess();
  if (current.operating_status !== "open")
    throw Error("Đã đọc lại nhưng chưa xác nhận cửa hàng đang mở. Hãy tải lại trước khi thử lại.");
  return { alreadyOpen: confirmedResponse && result?.alreadyOpen === true, recovered: !confirmedResponse };
}
