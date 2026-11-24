import { MapPin } from "lucide-react";
import { CATEGORY_EMOJI } from "@/lib/categories";
import {
  categories,
  type Category,
  type Location,
} from "@/lib/explore/useExplore";
import styles from "@/styles/explore.module.css";

type Props = {
  isAllSelected: boolean;
  openOnly?: boolean;
  location: Location;
  category: Category | null;
  onReset: () => void;
  onToggleOpenOnly?: () => void;
  onSelectLocation: (location: Location) => void;
  onSelectCategory: (category: Category | null) => void;
};

export default function ExploreFilters({
  isAllSelected,
  location,
  category,
  onReset,
  onSelectLocation,
  onSelectCategory,
}: Props) {
  return (
    <div
      className={styles.filters}
      role="group"
      aria-label="Bộ lọc khám phá"
      tabIndex={0}
    >
      <button type="button" aria-pressed={isAllSelected} onClick={onReset}>
        Tất cả
      </button>

      {(["KTX A", "KTX B"] as const).map((loc) => (
        <button
          type="button"
          key={loc}
          aria-pressed={location === loc}
          onClick={() => onSelectLocation(location === loc ? "all" : loc)}
        >
          <MapPin size={22} aria-hidden="true" />
          {loc}
        </button>
      ))}

      {categories.map((cat) => (
        <button
          type="button"
          key={cat}
          aria-pressed={category === cat}
          onClick={() => onSelectCategory(category === cat ? null : cat)}
        >
          <span aria-hidden="true">{CATEGORY_EMOJI[cat]}</span>
          {cat}
        </button>
      ))}
    </div>
  );
}
