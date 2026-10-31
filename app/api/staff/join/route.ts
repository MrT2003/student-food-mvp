import { handleStaffRequest } from "@/lib/seller/staff-http";
import { SellerServices } from "@/services/seller.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return await handleStaffRequest(request, (userId, input) => SellerServices.joinStaff(userId, input));
}
