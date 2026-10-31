import {
  CupSoda,
  Drumstick,
  Flame,
  MapPin,
  Soup,
  Utensils,
} from "lucide-react";
import {
  categories,
  type Category,
  type Location,
} from "@/lib/explore/useExplore";
import styles from "@/styles/explore.module.css";

const categoryIcons = {
  Cơm: Utensils,
  "Trà sữa": CupSoda,
  "Ăn vặt": Drumstick,
  "Món Việt": Soup,
  "Món Hàn": Flame,
};

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

      {categories.map((cat) => {
        const Icon = categoryIcons[cat];

        return (
          <button
            type="button"
            key={cat}
            aria-pressed={category === cat}
            onClick={() => onSelectCategory(category === cat ? null : cat)}
          >
            <Icon size={22} aria-hidden="true" />
            {cat}
          </button>
        );
      })}
    </div>
  );
}
