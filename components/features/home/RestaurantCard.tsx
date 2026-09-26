import { ArrowRight, CalendarDays, MapPin, Utensils } from "lucide-react";
import type { PreviewRestaurant } from "@/lib/home/mock-data";
import FoodPlaceholder from "./FoodPlaceholder";
import styles from "./home.module.css";
export default function RestaurantCard({ restaurant, onSelect }: { restaurant: PreviewRestaurant; onSelect: (restaurant: PreviewRestaurant) => void }) {
  return <article className={styles.restaurantCard}>
    <div className={styles.restaurantMedia}><FoodPlaceholder restaurant={restaurant} /><span className={styles.openBadge}><span className={styles.greenDot} />Đang nhận đơn</span></div>
    <h3>{restaurant.name}</h3>
    <p className={styles.location}><MapPin size={17} aria-hidden="true" />{restaurant.location}</p>
    <div className={styles.restaurantMeta}>
      <span><CalendarDays size={16} aria-hidden="true" />{restaurant.menuItemCount} món</span>
      <span title={restaurant.categories.join(", ")}><Utensils size={16} aria-hidden="true" /><span>{restaurant.categories.join(", ")}</span></span>
    </div>
    <button type="button" className={styles.primaryButton} onClick={() => onSelect(restaurant)}>Xem quán<ArrowRight size={18} aria-hidden="true" /></button>
  </article>;
}
