import { ArrowRight, Clock3, RotateCcw } from "lucide-react";
import type { PreviewRestaurant } from "@/lib/home/mock-data";
import FoodPlaceholder from "./FoodPlaceholder";
import styles from "@/styles/home.module.css";
import Link from "next/link";

export default function ReorderSection({
  restaurants,
  onSelect,
}: {
  restaurants: PreviewRestaurant[];
  onSelect: (restaurant: PreviewRestaurant) => void;
}) {
  return (
    <section
      id="reorder"
      className={styles.reorderSection}
      aria-labelledby="reorder-title"
    >
      <div className={styles.sectionHeading}>
        <h2 id="reorder-title">
          <span className={styles.sectionIcon}>
            <Clock3 size={25} aria-hidden="true" />
          </span>
          Đặt lại nhanh
        </h2>
        <Link className={styles.seeAll} href="/orders/history">
          Xem tất cả
          <ArrowRight size={21} aria-hidden="true" />
        </Link>
      </div>
      <div id="reorder-list" className={styles.restaurantGrid}>
        {restaurants.map((restaurant) => (
          <article key={restaurant.id} className={styles.reorderCard}>
            <FoodPlaceholder restaurant={restaurant} small />
            <div className={styles.reorderContent}>
              <h3>{restaurant.name}</h3>
              <p>Đã đặt {restaurant.orderCount} lần (dữ liệu mẫu)</p>
              <p
                className={styles.reorderCategories}
                title={restaurant.categories.join(", ")}
              >
                {restaurant.categories.join(", ")}
              </p>
              <button
                type="button"
                className={styles.outlineButton}
                onClick={() => onSelect(restaurant)}
              >
                <RotateCcw size={17} aria-hidden="true" />
                Đặt lại
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
