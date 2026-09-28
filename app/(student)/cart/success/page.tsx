import type { Metadata } from "next";
import OrderSuccessView from "@/components/features/cart/OrderSuccessView";

export const metadata: Metadata = {
  title: "Đặt hàng thành công | StudentFood",
  description: "Thông tin các đơn hàng vừa xác nhận.",
};

export default function OrderSuccessPage() {
  return <OrderSuccessView />;
}