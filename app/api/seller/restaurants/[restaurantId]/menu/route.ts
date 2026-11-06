import { menuRequest } from "@/lib/seller/menu-http";
export const runtime = "nodejs";
type Context = { params: Promise<{ restaurantId: string }> };
export const GET = (request: Request, context: Context) => menuRequest(request, context.params);
export const POST = (request: Request, context: Context) => menuRequest(request, context.params, true);
