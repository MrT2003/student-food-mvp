import { handleBankRequest } from "../_handler";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ restaurantId: string; bankId: string }> }) {
  return await handleBankRequest(request, params, "update");
}
