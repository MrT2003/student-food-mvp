import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SellerOrderServices, SellerOrdersError } from "@/services/seller-orders.service";

const errors = {
  VALIDATION_ERROR: [400, "ID cửa hàng hoặc đơn không hợp lệ."],
  UNAUTHORIZED: [401, "Vui lòng đăng nhập lại."],
  ORDER_FORBIDDEN: [403, "Không có quyền xem đơn của cửa hàng."],
  RESTAURANT_NOT_FOUND: [404, "Không tìm thấy cửa hàng thuộc quyền quản lý."],
  ORDER_NOT_FOUND: [404, "Không tìm thấy đơn của cửa hàng."],
  ORDERS_SCHEMA_MISMATCH: [503, "Cấu trúc hoặc quan hệ dữ liệu đơn chưa khớp API. Cần nhóm DB kiểm tra."],
  ORDERS_READ_FAILED: [503, "Không tải được đơn hàng. Vui lòng thử tải lại."],
} as const;
export async function readSellerOrders(params: Promise<{ restaurantId: string; orderId?: string }>) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new SellerOrdersError("UNAUTHORIZED");
    const { restaurantId, orderId } = await params;
    const result = orderId === undefined ? await SellerOrderServices.list(client, data.user.id, restaurantId)
      : await SellerOrderServices.detail(client, data.user.id, restaurantId, orderId);
    return NextResponse.json(result, { headers });
  } catch (error) {
    const code = error instanceof SellerOrdersError ? error.code : "ORDERS_READ_FAILED";
    const [status, message] = errors[code];
    return NextResponse.json({ error: { code, message } }, { status, headers });
  }
}
