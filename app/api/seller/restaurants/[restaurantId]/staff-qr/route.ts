import { handleStaffRequest } from "@/lib/seller/staff-http";
import { SellerServices } from "@/services/seller.service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  return await handleStaffRequest(request, async (userId, input) => {
    const { restaurantId } = await params;
    return await SellerServices.createStaffInvitation(userId, restaurantId, input);
  }, 201);
}
