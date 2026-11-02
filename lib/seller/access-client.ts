"use client";
import type { SellerAccess } from "@/types/seller-access.types";
export class SellerAccessClientError extends Error {
    constructor(public readonly status: number, public readonly code: string) {
        super("Chưa tải được thông tin cửa hàng. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu hồ sơ chưa khớp.");
    }
}
export function isSellerAccessDenied(error: unknown): boolean {
    const failure = error as { status?: number; code?: string } | null;
    return !!failure && (failure.status === 401 || failure.status === 403 ||
        ["SELLER_RESTAURANT_MISSING", "MULTIPLE_RESTAURANTS", "PROFILE_RESTAURANT_MISMATCH"].includes(failure.code ?? ""));
}
export async function readSellerAccess(): Promise<SellerAccess> {
    const response = await fetch("/api/seller/access", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new SellerAccessClientError(response.status, data?.error?.code ?? "ACCESS_READ_FAILED");
    if (!data?.user || !["student", "seller"].includes(data.user.role) || data.user.status !== "active" || (data.user.role === "seller" && !data.restaurant))
        throw new SellerAccessClientError(503, "ACCESS_READ_FAILED");
    return data;
}
export function invalidateSellerAccess() { window.dispatchEvent(new Event("seller-access-changed")); }
