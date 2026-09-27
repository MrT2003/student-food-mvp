import { CookingPot, CupSoda, Drumstick, Sandwich, Soup } from "lucide-react";
import type { PreviewRestaurant } from "@/lib/home/mock-data";
import styles from "./home.module.css";
const icons = { rice: CookingPot, tea: CupSoda, noodles: Soup, spicy: Soup, bread: Sandwich, chicken: Drumstick };
export default function FoodPlaceholder({ restaurant, small = false }: { restaurant: PreviewRestaurant; small?: boolean }) {
  const Icon = icons[restaurant.illustration];
  return <div className={`${styles.foodPlaceholder} ${small ? styles.smallPlaceholder : ""}`} aria-hidden="true"><span className={styles.placeholderCircle} /><Icon strokeWidth={1.25} /></div>;
}
