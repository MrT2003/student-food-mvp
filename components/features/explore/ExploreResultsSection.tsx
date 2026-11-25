import { Utensils } from "lucide-react";
import type { PopularDishCard } from "@/lib/explore/popular-data";
import type { SortBy } from "@/lib/explore/useExplore";
import ExploreDishCard from "./ExploreDishCard";
import styles from "@/styles/explore.module.css";

type Props = {
  dishes: PopularDishCard[];
  sortBy: SortBy;
  onSortChange: (sortBy: SortBy) => void;
  onResetFilters: () => void;
  compact?: boolean;
};

export default function ExploreResultsSection({
  dishes,
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
            <Utensils size={24} aria-hidden="true" />
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
            <option value="price-asc">Giá thấp đến cao</option>
            <option value="price-desc">Giá cao đến thấp</option>
            <option value="name">Tên A–Z</option>
          </select>
        </div>
      </div>

      <p className={styles.srOnly} role="status">
        Tìm thấy {dishes.length} món ăn.
      </p>

      {dishes.length > 0 ? (
        <div
          className={styles.restaurantGrid}
          data-compact={compact ? "true" : undefined}
        >
          {dishes.map((dish) => (
            <ExploreDishCard key={dish.id} dish={dish} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p>Không tìm thấy món ăn phù hợp.</p>
          <button type="button" onClick={onResetFilters}>
            Xóa bộ lọc
          </button>
        </div>
      )}
    </section>
  );
}
