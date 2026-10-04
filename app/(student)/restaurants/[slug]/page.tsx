import { notFound } from "next/navigation";
import RestaurantView from "@/components/features/restaurant/RestaurantView";
import { getRestaurantDetail } from "@/lib/restaurant/mock-data";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function RestaurantPage({ params }: Props) {
  const { slug } = await params;
  const restaurant = getRestaurantDetail(slug);

  if (!restaurant) notFound();

  return <RestaurantView key={restaurant.slug} restaurant={restaurant} />;
}