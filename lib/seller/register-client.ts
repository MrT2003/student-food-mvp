"use client";

import {readSellerAccess,invalidateSellerAccess} from "@/lib/seller/access-client";
import { getCurrentProfile } from "@/services/auth.service";
import { useAuthStore } from "@/store/useAuthStore";
import type { SellerRegistrationResult } from "@/types/seller.types";

const messages: Record<string, string> = {
  UNAUTHORIZED: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
  VALIDATION_ERROR: "Thông tin cửa hàng chưa hợp lệ. Vui lòng kiểm tra lại.",
  ACCOUNT_INACTIVE: "Tài khoản hiện không hoạt động.",
  PROFILE_NOT_FOUND: "Chưa có hồ sơ tài khoản hợp lệ.",
  ROLE_CONFLICT: "Tài khoản không còn là student đủ điều kiện đăng ký. Vui lòng tải lại hồ sơ.",
  DATABASE_ACCESS_DENIED: "Không có quyền đăng ký cửa hàng.",
  REGISTRATION_RPC_UNAVAILABLE: "Chức năng đăng ký chưa truy cập được RPC cần thiết. Vui lòng liên hệ nhóm phụ trách.",
  REGISTRATION_RESULT_UNKNOWN: "Chưa xác định được kết quả đăng ký. Kiểm tra lại hồ sơ và cửa hàng trước khi gửi lại.",
  REGISTRATION_FAILED: "Không thể xác nhận đăng ký. Kiểm tra lại hồ sơ và cửa hàng trước khi gửi lại.",
  SLUG_CONFLICT: "Chưa thể tạo địa chỉ cửa hàng. Vui lòng thử lại.",
};

export async function submitSellerRegistration(input: unknown): Promise<SellerRegistrationResult | {recovered:true;message:string}> {
  const actor=useAuthStore.getState().user?.id;
  if(!actor)throw new Error("Vui lòng đợi tải tài khoản hoặc đăng nhập lại.");
  // Cookie cùng origin, không nhận owner/role từ client và không fallback preview.
  const response = await fetch("/api/seller/register", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => { throw new Error("Chưa xác định được kết quả đăng ký. Kiểm tra lại hồ sơ trước khi gửi lại."); });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // Only a confirmed existing seller+owned restaurant can recover a duplicate.
    if(response.status===409&&body?.error?.code==="ROLE_CONFLICT"){
      try{
        const [access,profile]=await Promise.all([readSellerAccess(),getCurrentProfile()]);
        if(access.user.id===actor&&access.user.role==="seller"&&access.restaurant&&profile?.id===actor&&profile.role==="seller"&&profile.status==="active"&&useAuthStore.getState().user?.id===actor){
          useAuthStore.getState().setUser(profile);invalidateSellerAccess();
          return {recovered:true,message:"Đã xác nhận cửa hàng của bạn."};
        }
      }catch { /* Uncertain recovery must not create a success or retry a write. */ }
    }
    throw new Error(messages[body?.error?.code] ?? "Không thể đăng ký cửa hàng. Vui lòng thử lại sau.");
  }
  if (response.status !== 201 || body?.role !== "seller" || body?.paymentSelectionPersisted !== false
    || typeof body?.restaurant?.id !== "string" || typeof body?.restaurant?.slug !== "string"
    || body?.restaurant?.operating_status !== "closed") {
    throw new Error("Phản hồi đăng ký chưa hợp lệ. Kiểm tra lại hồ sơ trước khi gửi lại.");
  }
  try {
    // public.users đổi role không bảo đảm phát sinh Auth event; đọc lại hồ sơ thật.
    const profile = await getCurrentProfile();
    const access=await readSellerAccess();
    if (!profile || profile.id!==actor || profile.role !== "seller" || profile.status !== "active" || access.user.id!==actor || access.user.role!=="seller" || access.restaurant?.id!==body.restaurant.id || useAuthStore.getState().user?.id!==actor) throw new Error();
    useAuthStore.getState().setUser(profile);
    invalidateSellerAccess();
  } catch {
    throw new Error("API đã xác nhận đăng ký nhưng chưa tải được hồ sơ seller. Hãy tải lại trang, không gửi lại đăng ký.");
  }
  return { restaurant: { id: body.restaurant.id, slug: body.restaurant.slug, operating_status: "closed" },
    role: "seller", paymentSelectionPersisted: false,
    message: "Đăng ký thành công. Cửa hàng đang đóng; lựa chọn thanh toán chưa được lưu hoặc áp dụng." };
}
