import OrderTrackingView from "@/components/features/orders/OrderTrackingView";

type OrderTrackingPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderTrackingPage({
  params,
}: OrderTrackingPageProps) {
  const { orderId } = await params;

  return <OrderTrackingView key={orderId} orderId={orderId} />;
}
