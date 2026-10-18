import OrderDetailView from "@/components/features/orders/OrderDetailView";

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { orderId } = await params;

  return <OrderDetailView key={orderId} orderId={orderId} />;
}
