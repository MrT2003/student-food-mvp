import type { Metadata, Viewport } from "next";
import DeliveryDashboard from "@/components/features/delivery/DeliveryDashboard";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Đơn cần giao | StudentFood",
  description: "Giao diện quản lý đơn cần giao dành cho người giao hàng.",
};

export default function DeliverDemoPage() {
  return <DeliveryDashboard />;
}
