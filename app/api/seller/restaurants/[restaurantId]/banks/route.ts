import { handleBankRequest } from "./_handler";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  return await handleBankRequest(request, params, "create");
}
