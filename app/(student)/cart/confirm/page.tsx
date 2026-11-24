import type { Metadata } from "next";
import OrderConfirmView from "@/components/features/cart/OrderConfirmView";

export const metadata: Metadata = {
  title: "Xác nhận đơn hàng | StudentFood",
  description: "Kiểm tra thông tin trước khi đặt hàng.",
};

export default function OrderConfirmPage() {
  return <OrderConfirmView />;
}