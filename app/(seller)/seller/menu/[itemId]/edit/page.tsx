import type { Metadata } from "next";
import SellerMenuCreateView from "@/components/features/seller/SellerMenuCreateView";

export const metadata: Metadata = { title: "Chỉnh sửa món | StudentFood" };

export default async function SellerMenuEditPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return <SellerMenuCreateView key={itemId} itemId={itemId} />;
}
