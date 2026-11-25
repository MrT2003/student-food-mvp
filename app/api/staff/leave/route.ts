import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleStaffRequest } from "@/lib/seller/staff-http";
import { SellerServices } from "@/services/seller.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleStaffRequest(request, (userId, input, client) => SellerServices.leaveStaff(userId, input, client));
}


// Read the actor's current membership even after staff permissions are gone.
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const unavailable = () => NextResponse.json(
    { error: { code: "STAFF_LEAVE_PROFILE_UNAVAILABLE" } }, { status: 503, headers },
  );
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user)
      return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
    const profile = await client.from("users")
      .select("id,role,status,work_for_restaurant_id").eq("id", data.user.id).maybeSingle();
    if (profile.error || !profile.data) return unavailable();
    const { id, role, status, work_for_restaurant_id } = profile.data;
    return NextResponse.json({ profile: { id, role, status, work_for_restaurant_id } }, { headers });
  } catch {
    return unavailable();
  }
}
