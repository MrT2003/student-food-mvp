import { notFound } from "next/navigation";
import DishView from "@/components/features/dish/DishView";
import { restaurantService } from "@/services/restaurant.service";

type Props = {
  params: Promise<{
    slug: string;
    itemId: string;
  }>;
};

export default async function DishPage({ params }: Props) {
  const { slug, itemId } = await params;

  const [menu, item] = await Promise.all([
    restaurantService.getRestaurantMenu(slug),
    restaurantService.getMenuItem(slug, itemId),
  ]);

  if (!menu || !item) notFound();

  if (item.restaurant_id !== menu.restaurant.id) {
    notFound();
  }

  return (
    <DishView
      key={`${menu.restaurant.id}/${item.id}`}
      restaurant={menu.restaurant}
      item={item}
    />
  );
}
