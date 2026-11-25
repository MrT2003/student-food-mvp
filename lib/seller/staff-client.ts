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


export async function leaveStaffRestaurant(actorId: string, restaurantId: string) {
    const matchesAssignment = () => {
        const user = useAuthStore.getState().user;
        return user?.id === actorId && user.role === "staff" &&
            user.work_for_restaurant_id === restaurantId;
    };
    const conflict = "Quan hệ nhân viên đã thay đổi. Hãy kiểm tra lại cửa hàng hiện tại.";
    const unknown = "Chưa xác nhận được kết quả rời cửa hàng. Hãy tải lại hồ sơ trước khi thử lại.";
    if (!matchesAssignment()) throw Error(conflict);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response | undefined;
    let data;
    try {
        response = await fetch("/api/staff/leave", {
            method: "POST", credentials: "same-origin", cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId }), signal: controller.signal,
        });
        data = await response.json();
    } catch {
        // The write may already have committed. Reconcile through the profile.
    } finally {
        clearTimeout(timeout);
    }
    const code = data?.error?.code;
    const rejected = code === "STAFF_LEAVE_CONFLICT";
    const failures: Record<string, string> = {
        STAFF_LEAVE_RPC_UNAVAILABLE: "API chưa gọi được RPC rời cửa hàng. Cần kiểm tra triển khai, chữ ký và schema cache.",
        STAFF_LEAVE_REJECTED: "Database từ chối cập nhật quan hệ nhân viên. Vui lòng liên hệ hỗ trợ.",
        DATABASE_ACCESS_DENIED: "Tài khoản chưa có quyền database để rời cửa hàng.",
        UNAUTHORIZED: messages.UNAUTHORIZED,
        FORBIDDEN: "Yêu cầu rời cửa hàng không hợp lệ. Hãy tải lại trang.",
        VALIDATION_ERROR: "Định danh cửa hàng không hợp lệ. Hãy tải lại trang.",
        INVALID_JSON: "Dữ liệu yêu cầu rời cửa hàng không hợp lệ. Hãy tải lại trang.",
    };
    if (response && !response.ok && typeof code === "string" && Object.hasOwn(failures, code))
        throw Error(failures[code]);

    const confirmedWrite = response?.ok && data?.profile?.id === actorId &&
        data.profile.role === "student" && data.profile.work_for_restaurant_id === null;
    const readError = confirmedWrite
        ? "Backend đã xác nhận bạn rời cửa hàng, nhưng chưa tải được trạng thái mới. Hãy tải lại trang."
        : unknown;
    const readController = new AbortController();
    const readTimeout = setTimeout(() => readController.abort(), 10000);
    let profile;
    try {
        const read = await fetch("/api/staff/leave", {
            method: "GET", credentials: "same-origin", cache: "no-store", signal: readController.signal,
        });
        if (read.ok) profile = (await read.json())?.profile;
    } catch {
        // Readback failure must not replace a definite POST result.
    } finally {
        clearTimeout(readTimeout);
    }
    const current = useAuthStore.getState().user;
    if (!profile || profile.id !== actorId || current?.id !== actorId || profile.status !== "active" ||
        !["student", "staff", "seller"].includes(profile.role) ||
        (profile.role === "staff" ? typeof profile.work_for_restaurant_id !== "string" : profile.work_for_restaurant_id !== null))
        throw Error(rejected ? conflict : readError);

    // Keep a newer assignment already observed by this tab over an old read.
    if (current.role !== "student" && !matchesAssignment()) throw Error(conflict);
    useAuthStore.getState().setUser({
        ...current, role: profile.role, status: profile.status,
        work_for_restaurant_id: profile.work_for_restaurant_id,
    });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("seller-access-changed"));
    if (rejected) throw Error(conflict);
    if (profile.role !== "student" || profile.work_for_restaurant_id !== null) {
        if (confirmedWrite || profile.role !== "staff" || profile.work_for_restaurant_id !== restaurantId)
            throw Error(conflict);
        throw Error(unknown);
    }
}
