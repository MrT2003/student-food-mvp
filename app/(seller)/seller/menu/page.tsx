import type { Metadata } from "next";
import SellerMenuView from "@/components/features/seller/SellerMenuView";

export const metadata: Metadata = { title: "Quản lý menu | StudentFood" };
export default function SellerMenuPage() {
  return <SellerMenuView />;
}
