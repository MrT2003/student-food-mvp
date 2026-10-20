import { CookingPot, CupSoda, Drumstick, Sandwich, Soup } from "lucide-react";
import type { PreviewRestaurant } from "@/lib/home/mock-data";
import styles from "@/styles/home.module.css";
const icons = {
  rice: CookingPot,
  tea: CupSoda,
  noodles: Soup,
  spicy: Soup,
  bread: Sandwich,
  chicken: Drumstick,
};
export default function FoodPlaceholder({
  restaurant,
  small = false,
}: {
  restaurant: PreviewRestaurant;
  small?: boolean;
}) {
  const Icon = icons[restaurant.illustration];
  return (
    <div
      className={`${styles.foodPlaceholder} ${small ? styles.smallPlaceholder : ""}`}
      aria-hidden={!restaurant.avatar_url}
    >
      {restaurant.avatar_url ? (
        <img
          src={restaurant.avatar_url}
          alt={restaurant.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            position: "relative",
            zIndex: 1,
          }}
        />
      ) : (
        <>
          <span className={styles.placeholderCircle} />
          <Icon strokeWidth={1.25} />
        </>
      )}
    </div>
  );
}
