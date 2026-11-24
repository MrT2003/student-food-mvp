import type { Metadata } from "next";
import SellerMenuCreateView from "@/components/features/seller/SellerMenuCreateView";

export const metadata: Metadata = { title: "Thêm món mới | StudentFood" };

export default function SellerMenuCreatePage() {
  return <SellerMenuCreateView />;
}
