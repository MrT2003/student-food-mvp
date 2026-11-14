import type { Metadata } from "next";
import DeliveryDashboard from "@/components/features/delivery/DeliveryDashboard";

export const metadata: Metadata = {
  title: "Đơn cần giao | StudentFood",
  description: "Giao diện quản lý đơn cần giao dành cho người giao hàng.",
};

export default function DeliveryDemoPage() {
  return <DeliveryDashboard />;
}
