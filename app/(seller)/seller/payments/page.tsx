import type { Metadata } from "next";
import SellerPaymentView from "@/components/features/seller/SellerPaymentView";

export const metadata: Metadata = { title: "Thanh toán | StudentFood" };
export default function SellerPaymentsPage() { return <SellerPaymentView />; }
