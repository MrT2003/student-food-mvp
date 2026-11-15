import { menuRequest } from "@/lib/seller/menu-http";
export const runtime = "nodejs";
type Context = { params: Promise<{ restaurantId: string; itemId: string }> };
export const GET = (request: Request, context: Context) => menuRequest(request, context.params);
export const PATCH = (request: Request, context: Context) => menuRequest(request, context.params, true);
