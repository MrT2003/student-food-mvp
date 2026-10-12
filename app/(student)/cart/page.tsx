import type { Metadata } from "next";
import CartView from "@/components/features/cart/CartView";

export const metadata: Metadata = {
  title: "Giỏ hàng | StudentFood",
  description: "Kiểm tra các món ăn trong giỏ hàng của bạn.",
};

export default function CartPage() {
  return <CartView />;
}