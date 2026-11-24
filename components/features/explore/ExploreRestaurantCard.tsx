import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Utensils } from "lucide-react";
import type { ExploreRestaurant } from "@/lib/explore/mock-data";
import ExploreFoodPlaceholder from "./ExploreFoodPlaceholder";
import styles from "@/styles/explore.module.css";

export default function ExploreRestaurantCard({
  restaurant,
}: {
  restaurant: ExploreRestaurant;
}) {
  return (
    <article className={styles.restaurantCard}>
      <div className={styles.restaurantMedia}>
        <ExploreFoodPlaceholder
          kind={restaurant.kind}
          imageUrl={restaurant.imageUrl}
        />
      </div>

      <div className={styles.restaurantContent}>
        <div className={styles.restaurantTop}>
          <h3>{restaurant.name}</h3>

          <span
            className={`${styles.openBadge} ${
              !restaurant.isOpen ? styles.closedBadge : ""
            }`}
          >
            <span className={styles.greenDot} aria-hidden="true" />
            {restaurant.isOpen ? "Đang mở" : "Đã đóng"}
          </span>
        </div>

        <p className={styles.location}>
          <MapPin size={17} aria-hidden="true" />
          {restaurant.location}
        </p>

        <div className={styles.meta}>
          <span>
            <CalendarDays size={15} aria-hidden="true" />
            {restaurant.menuCount} món
          </span>

          <span title={restaurant.categories.join(", ")}>
            <Utensils size={15} aria-hidden="true" />
            <span>{restaurant.categories.join(", ")}</span>
          </span>
        </div>

        <Link
          href={`/restaurants/${encodeURIComponent(restaurant.slug)}`}
          className={styles.primaryButton}
          aria-label={`Xem quán ${restaurant.name}`}
        >
          Xem quán
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
