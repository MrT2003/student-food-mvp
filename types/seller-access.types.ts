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
};
