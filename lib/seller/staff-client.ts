"use client";
import { getCurrentProfile } from "@/services/auth.service";
import { useAuthStore } from "@/store/useAuthStore";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const messages: Record<string, string> = {
    STAFF_JOIN_RPC_UNAVAILABLE: "Chức năng gia nhập chưa sẵn sàng. Vui lòng thử lại sau.",
    STAFF_JOIN_RESULT_UNKNOWN: "Chưa xác định được kết quả. Hãy kiểm tra hồ sơ trước khi quét lại.",
    UNAUTHORIZED: "Vui lòng đăng nhập lại.",
    STAFF_JOIN_ATOMICITY_UNAVAILABLE: "Chức năng gia nhập đang tạm ngưng. Vui lòng thử lại sau.",
    STAFF_TOKEN_EXPIRED: "Mã QR đã hết hạn. Hãy xin mã mới.",
    INVALID_STAFF_TOKEN: "Mã QR không hợp lệ.",
    STAFF_TOKEN_CONFIGURATION_MISSING: "Chưa thể tạo mã QR. Vui lòng thử lại sau.",
    STAFF_MEMBERSHIP_CONFLICT: "Bạn đã thuộc một cửa hàng.",
    STAFF_ROLE_CONFLICT: "Chỉ sinh viên chưa thuộc cửa hàng được gia nhập.",
    ACCOUNT_INACTIVE: "Tài khoản hiện không hoạt động.",
    ISSUER_NOT_ALLOWED: "Lời mời không còn hợp lệ.",
    RESTAURANT_NOT_FOUND: "Cửa hàng không còn phù hợp với lời mời.",
};

export async function staffRequest(path: string, body: unknown) {
    const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
    }).catch(() => {
        throw Error("Chưa xác định được kết quả. Hãy kiểm tra lại hồ sơ trước khi thử lại.");
    });
    const data = await response.json().catch(() => null);
    if (!response.ok)
        throw Error(messages[data?.error?.code] ?? "Không thể hoàn tất thao tác. Vui lòng thử lại sau.");
    return data;
}

export function parseStaffQr(raw: string): string {
    if (raw.length > 6000)
        throw Error("Mã QR không được hỗ trợ.");
    let value;
    try {
        value = JSON.parse(raw);
    } catch {
        throw Error("Mã QR không được hỗ trợ.");
    }
    if (
        !value ||
        Array.isArray(value) ||
        Object.keys(value).sort().join(",") !== "token,type,version" ||
        value.type !== "studentfood.staff-invite" ||
        value.version !== 1 ||
        typeof value.token !== "string" ||
        value.token.length > 4096 ||
        (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.token) && !uuidRegex.test(value.token))
    )
        throw Error("Mã QR không được hỗ trợ.");
    return value.token;
}

export function extractRestaurantIdFromStaffQr(token: string | null): string | null {
    if (!token) return null;
    if (uuidRegex.test(token)) return token.toLowerCase();
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    try {
        const base64 = parts[0].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        const decoded = typeof atob === "function"
            ? atob(padded)
            : Buffer.from(parts[0], "base64url").toString("utf8");
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed.restaurantId === "string" && uuidRegex.test(parsed.restaurantId)) {
            return parsed.restaurantId.toLowerCase();
        }
    } catch {
        return null;
    }
    return null;
}

// Ephemeral navigation handoff only: never persist/log the invitation or put it in a URL.
let scanned: string | null = null;
export function holdStaffToken(token: string) {
    scanned = token;
}
export function takeStaffToken() {
    const token = scanned;
    scanned = null;
    return token;
}
export function peekStaffToken() {
    return scanned;
}

export async function joinScannedStaff(token: string) {
    const data = await staffRequest("/api/staff/join", { token });
    if (
        data?.profile?.role !== "staff" ||
        typeof data.profile.id !== "string" ||
        typeof data.profile.work_for_restaurant_id !== "string"
    )
        throw Error("Chưa xác định được kết quả. Hãy kiểm tra hồ sơ.");
    const profile = await getCurrentProfile();
    if (
        !profile ||
        profile.id !== data.profile.id ||
        profile.role !== "staff" ||
        profile.work_for_restaurant_id !== data.profile.work_for_restaurant_id
    )
        throw Error("Chưa tải được hồ sơ mới. Hãy tải lại trang trước khi thử lại.");
    useAuthStore.getState().setUser(profile);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new Event("seller-access-changed"));
    }
    return profile;
}
