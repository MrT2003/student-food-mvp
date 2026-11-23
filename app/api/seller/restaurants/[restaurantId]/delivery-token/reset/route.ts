import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/http/request-origin";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ restaurantId: string }> },
) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN" } },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { restaurantId } = await context.params;
    if (!UUID_RE.test(restaurantId)) {
      return NextResponse.json(
        { error: { code: "INVALID_RESTAURANT_ID" } },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED" } },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: profile, error: profileError } = await client
      .from("users")
      .select("role, status")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: { code: "ACCESS_READ_FAILED" } },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!profile || profile.role !== "seller" || profile.status !== "active") {
      return NextResponse.json(
        { error: { code: "SELLER_REQUIRED" } },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: owned, error: ownedError } = await client
      .from("restaurants")
      .select("id")
      .eq("id", restaurantId)
      .eq("owner_id", auth.user.id)
      .maybeSingle();

    if (ownedError) {
      return NextResponse.json(
        { error: { code: "ACCESS_READ_FAILED" } },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!owned) {
      return NextResponse.json(
        { error: { code: "RESTAURANT_NOT_FOUND" } },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { error: rpcError } = await client.rpc("reset_delivery_token", {
      p_restaurant_id: restaurantId,
    });

    if (rpcError) {
      if (rpcError.code === "PGRST202" || rpcError.code === "42883") {
        const now = new Date().toISOString();
        const nextToken = randomUUID();
        const { error: updateError } = await client
          .from("restaurants")
          .update({
            delivery_token: nextToken,
            delivery_token_updated_at: now,
          })
          .eq("id", restaurantId)
          .eq("owner_id", auth.user.id);
        if (updateError) {
          return NextResponse.json(
            { error: { code: "DELIVERY_TOKEN_RESET_FAILED" } },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      } else {
        return NextResponse.json(
          { error: { code: "DELIVERY_TOKEN_RESET_FAILED" } },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    const { data: updatedShop, error: readBackError } = await client
      .from("restaurants")
      .select("delivery_token, delivery_token_updated_at")
      .eq("id", restaurantId)
      .eq("owner_id", auth.user.id)
      .maybeSingle();

    if (readBackError || !updatedShop) {
      return NextResponse.json(
        { error: { code: "DELIVERY_TOKEN_READ_FAILED" } },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        delivery_token: updatedShop.delivery_token,
        delivery_token_updated_at: updatedShop.delivery_token_updated_at,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: { code: "DELIVERY_TOKEN_RESET_FAILED" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
