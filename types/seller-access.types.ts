export type SellerWorkspaceTab =
    | "overview"
    | "orders"
    | "menu"
    | "shop"
    | "payments";

export type SellerAccess = {
    user: {
        id: string;
        role: "student" | "seller" | "staff";
        status: "active";
        work_for_restaurant_id: string | null;
    };
    restaurant: {
        id: string;
        name: string;
        slug: string;
        contact_phone?: string | null;
        contact_phone_available?: boolean;
        avatar_url: string | null;
        description: string | null;
        location: string | null;
        status: string;
        operating_status: string;
        operating_hours: unknown;
    } | null;
    allowed_tabs?: SellerWorkspaceTab[];
    default_tab?: "/seller" | "/seller/orders";
};

export function resolveAllowedSellerTabs(
    access: SellerAccess | null | undefined,
): SellerWorkspaceTab[] {
    if (!access?.restaurant) return [];
    if (Array.isArray(access.allowed_tabs) && access.allowed_tabs.length > 0) {
        return access.allowed_tabs;
    }
    if (access.user.role === "seller") {
        return ["overview", "orders", "menu", "shop", "payments"];
    }
    if (access.user.role === "staff") {
        return ["overview", "orders", "shop"];
    }
    return [];
}

export function resolveSellerTabFromPath(
    pathname: string | null | undefined,
): SellerWorkspaceTab | null {
    if (!pathname || !pathname.startsWith("/seller") || pathname.startsWith("/seller/register")) {
        return null;
    }
    if (pathname === "/seller") return "overview";
    if (pathname === "/seller/orders" || pathname.startsWith("/seller/orders/")) return "orders";
    if (pathname === "/seller/menu" || pathname.startsWith("/seller/menu/")) return "menu";
    if (pathname === "/seller/shop" || pathname.startsWith("/seller/shop/")) return "shop";
    if (pathname === "/seller/payments" || pathname.startsWith("/seller/payments/")) return "payments";
    return null;
}

export function isSellerPathAllowed(
    pathname: string | null | undefined,
    access: SellerAccess | null | undefined,
): boolean {
    const tab = resolveSellerTabFromPath(pathname);
    if (!tab) return true;
    const allowed = resolveAllowedSellerTabs(access);
    return allowed.includes(tab);
}

