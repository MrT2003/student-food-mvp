import { NextResponse } from "next/server";
import { DeliveryService, DeliveryServiceError } from "@/services/delivery.service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const data = await DeliveryService.getByToken(token);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const failure =
      error instanceof DeliveryServiceError
        ? error
        : new DeliveryServiceError("DELIVERY_READ_FAILED", 503);
    return NextResponse.json(
      { error: { code: failure.code } },
      { status: failure.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
