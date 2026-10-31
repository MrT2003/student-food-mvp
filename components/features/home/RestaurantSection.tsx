import { ArrowRight, Store } from "lucide-react";
import Link from "next/link";
import type { PreviewRestaurant } from "@/lib/home/mock-data";
import RestaurantCard from "./RestaurantCard";
import styles from "@/styles/home.module.css";
type Props = {
  restaurants: PreviewRestaurant[];
  onSelect: (restaurant: PreviewRestaurant) => void;
  onReset: () => void;
  searching: boolean;
  compact?: boolean;
};
export default function RestaurantSection({
  restaurants,
  onSelect,
  onReset,
  searching,
  compact = !searching,
}: Props) {
  return (
    <section
      id="restaurants"
      className={styles.restaurantSection}
      aria-labelledby="restaurants-title"
    >
      <div className={styles.sectionHeading}>
        <h2 id="restaurants-title">
          <span className={styles.sectionIcon}>
            <Store size={23} aria-hidden="true" />
          </span>
          {searching ? "Kết quả tìm kiếm" : "Quán đang mở"}
        </h2>
        <Link href="/open-restaurants" className={styles.seeAll}>
          Xem tất cả
          <ArrowRight size={21} aria-hidden="true" />
        </Link>
      </div>
      <span className="sr-only" role="status">
        Tìm thấy {restaurants.length} quán.
      </span>
      {restaurants.length ? (
        <div
          className={styles.restaurantGrid}
          data-compact={compact ? "true" : undefined}
        >
          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p>Chưa tìm thấy quán phù hợp.</p>
          <button type="button" className={styles.seeAll} onClick={onReset}>
            Xóa bộ lọc
          </button>
        </div>
      )}
    </section>
  );
}
