import { Store } from "lucide-react";
import type { ExploreRestaurant } from "@/lib/explore/mock-data";
import type { SortBy } from "@/lib/explore/useExplore";
import ExploreRestaurantCard from "./ExploreRestaurantCard";
import styles from "@/styles/explore.module.css";

type Props = {
  restaurants: ExploreRestaurant[];
  sortBy: SortBy;
  onSortChange: (sortBy: SortBy) => void;
  onResetFilters: () => void;
  compact?: boolean;
};

export default function ExploreResultsSection({
  restaurants,
  sortBy,
  onSortChange,
  onResetFilters,
  compact = false,
}: Props) {
  return (
    <section
      className={styles.results}
      aria-labelledby="explore-results-title"
    >
      <div className={styles.sectionHeading}>
        <h2 id="explore-results-title">
          <span className={styles.sectionIcon}>
            <Store size={24} aria-hidden="true" />
          </span>
          Kết quả khám phá
        </h2>

        <div className={styles.sort}>
          <label htmlFor="explore-sort">Sắp xếp:</label>
          <select
            id="explore-sort"
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value as SortBy)}
          >
            <option value="popular">Phổ biến</option>
            <option value="name">Tên A–Z</option>
            <option value="menu">Nhiều món nhất</option>
          </select>
        </div>
      </div>

      <p className={styles.srOnly} role="status">
        Tìm thấy {restaurants.length} quán.
      </p>

      {restaurants.length > 0 ? (
        <div
          className={styles.restaurantGrid}
          data-compact={compact ? "true" : undefined}
        >
          {restaurants.map((restaurant) => (
            <ExploreRestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
            />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p>Không tìm thấy quán phù hợp.</p>
          <button type="button" onClick={onResetFilters}>
            Xóa bộ lọc
          </button>
        </div>
      )}
    </section>
  );
}
