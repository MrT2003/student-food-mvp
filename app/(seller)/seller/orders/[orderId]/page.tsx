import type { Metadata } from "next";
import SellerOrderDetailView from "@/components/features/seller/SellerOrderDetailView";

export const metadata: Metadata = {
  title: "Chi tiết đơn hàng | StudentFood",
};

type SellerOrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function SellerOrderDetailPage({
  params,
}: SellerOrderDetailPageProps) {
  const { orderId } = await params;

  return <SellerOrderDetailView key={orderId} orderId={orderId} />;
}
