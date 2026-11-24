import { NextResponse } from "next/server";
import { DeliveryService, DeliveryServiceError } from "@/services/delivery.service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string; orderId: string }> },
) {
  try {
    const { token, orderId } = await context.params;
    const data = await DeliveryService.completeOrderByToken(token, orderId);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const failure =
      error instanceof DeliveryServiceError
        ? error
        : new DeliveryServiceError("DELIVERY_COMPLETE_FAILED", 503);
    return NextResponse.json(
      { error: { code: failure.code } },
      { status: failure.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
