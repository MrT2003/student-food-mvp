"use client";
import type { SellerAccess } from "@/types/seller-access.types";
export async function readSellerAccess(): Promise<SellerAccess> {
    const response = await fetch("/api/seller/access", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.user || !["student", "seller"].includes(data.user.role) || data.user.status !== "active" || (data.user.role === "seller" && !data.restaurant))
        throw Error("Chưa tải được thông tin cửa hàng. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu hồ sơ chưa khớp.");
    return data;
}
export function invalidateSellerAccess() { window.dispatchEvent(new Event("seller-access-changed")); }
