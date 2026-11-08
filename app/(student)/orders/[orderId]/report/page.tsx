import OrderReportView from "@/components/features/orders/OrderReportView";

type OrderReportPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderReportPage({
  params,
}: OrderReportPageProps) {
  const { orderId } = await params;

  return <OrderReportView key={orderId} orderId={orderId} />;
}
