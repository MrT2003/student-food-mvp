import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SellerAccess } from "@/types/seller-access.types";
export class SellerAccessError extends Error {
    constructor(public readonly code: string, public readonly status: number) { super(code); }
}
export const SellerAccessServices = {
    async read(client: SupabaseClient): Promise<SellerAccess> {
        const { data, error } = await client.auth.getUser();
        if (error || !data.user)
            throw new SellerAccessError("UNAUTHORIZED", 401);
        const id = data.user.id;
        const profile = await client.from("users").select("id,role,status,work_for_restaurant_id").eq("id", id).maybeSingle();
        if (profile.error)
            throw new SellerAccessError("ACCESS_READ_FAILED", 503);
        if (!profile.data)
            throw new SellerAccessError("PROFILE_NOT_FOUND", 403);
        if (profile.data.status !== "active")
            throw new SellerAccessError("ACCOUNT_INACTIVE", 403);
        if (!["student", "seller"].includes(profile.data.role) || profile.data.work_for_restaurant_id !== null)
            throw new SellerAccessError("NOT_ELIGIBLE", 403);
        // Limit two is an anomaly check, not arbitrary first-restaurant selection.
        const owned = await client.from("restaurants").select("id,name,slug,avatar_url,description,location,status,operating_status,operating_hours").eq("owner_id", id).limit(2);
        if (owned.error)
            throw new SellerAccessError("ACCESS_READ_FAILED", 503);
        if (!Array.isArray(owned.data))
            throw new SellerAccessError("ACCESS_READ_FAILED", 503);
        if (owned.data.length > 1)
            throw new SellerAccessError("MULTIPLE_RESTAURANTS", 409);
        if (profile.data.role === "seller" && !owned.data.length)
            throw new SellerAccessError("SELLER_RESTAURANT_MISSING", 409);
        if (profile.data.role === "student" && owned.data.length)
            throw new SellerAccessError("PROFILE_RESTAURANT_MISMATCH", 409);
        const row = owned.data[0];
        return { user: { id, role: profile.data.role, status: "active", work_for_restaurant_id: null }, restaurant: row ? { id: row.id, name: row.name, slug: row.slug, avatar_url: row.avatar_url, description: row.description, location: row.location, status: row.status, operating_status: row.operating_status, operating_hours: row.operating_hours } : null };
    }
};
