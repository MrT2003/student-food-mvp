import type { Metadata } from "next";
import SellerOverviewView from "@/components/features/seller/SellerOverviewView";

export const metadata: Metadata = { title: "Tổng quan cửa hàng | StudentFood" };

export default function SellerOverviewPage() {
  return <SellerOverviewView />;
}
