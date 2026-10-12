import type { Metadata } from "next";
import SellerOrdersView from "@/components/features/seller/SellerOrdersView";

export const metadata: Metadata = { title: "Đơn hàng của cửa hàng | StudentFood" };
export default function SellerOrdersPage() {
  return <SellerOrdersView />;
}
