import { notFound } from "next/navigation";
import RestaurantView from "@/components/features/restaurant/RestaurantView";
import { restaurantService } from "@/services/restaurant.service";
import { toRestaurantView } from "@/lib/restaurant/view-model";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function RestaurantPage({ params }: Props) {
  const { slug } = await params;

  const data = await restaurantService.getRestaurantMenu(slug);

  if (!data) notFound();

  return (
    <RestaurantView
      key={data.restaurant.id}
      restaurant={toRestaurantView(data)}
    />
  );
}
