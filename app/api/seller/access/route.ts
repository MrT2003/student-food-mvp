import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SellerAccessError, SellerAccessServices } from "@/services/seller-access.service";
export const runtime = "nodejs";
export async function GET() {
    try {
        return NextResponse.json(await SellerAccessServices.read(await createClient()), { headers: { "Cache-Control": "no-store" } });
    }
    catch (e) {
        const code = e instanceof SellerAccessError ? e.code : "ACCESS_READ_FAILED", status = e instanceof SellerAccessError ? e.status : 503;
        return NextResponse.json({ error: { code } }, { status, headers: { "Cache-Control": "no-store" } });
    }
}
