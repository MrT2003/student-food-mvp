import { notFound } from "next/navigation";
import DishView from "@/components/features/dish/DishView";
import { getRestaurantDetail } from "@/lib/restaurant/mock-data";
import { getDishOptions } from "@/lib/dish/options";

type Props = {
  params: Promise<{
    slug: string;
    itemId: string;
  }>;
};

export default async function DishPage({ params }: Props) {
  const { slug, itemId } = await params;
  const restaurant = getRestaurantDetail(slug);

  if (!restaurant) notFound();

  const item = restaurant.menu.find((dish) => dish.id === itemId);

  if (!item) notFound();

  return (
    <DishView
      key={`${slug}/${itemId}`}
      restaurant={{
        slug: restaurant.slug,
        name: restaurant.name,
        location: restaurant.location,
        isOpen: restaurant.isOpen,
      }}
      item={item}
      options={getDishOptions(slug, itemId)}
    />
  );
}