import { CupSoda, Drumstick, MapPin, Utensils } from "lucide-react";
import type { HomeFilters as Filters } from "@/types/home.types";
import type { Dispatch, SetStateAction } from "react";
import styles from "./home.module.css";
type Props = { filters: Filters; onChange: Dispatch<SetStateAction<Filters>>; onReset: () => void };
export default function HomeFilters({ filters, onChange, onReset }: Props) {
  const isAll = !filters.openOnly && filters.location === "all" && filters.category === "all";
  return <div className={styles.filters} role="group" aria-label="Lọc quán ăn">
    <button type="button" aria-pressed={isAll} onClick={onReset}>Tất cả</button>
    <button type="button" aria-pressed={filters.openOnly} onClick={() => onChange((value) => ({ ...value, openOnly: !value.openOnly }))}><span className={styles.greenDot} />Đang mở</button>
    {(["KTX A", "KTX B"] as const).map((location) => <button key={location} type="button" aria-pressed={filters.location === location} onClick={() => onChange((value) => ({ ...value, location: value.location === location ? "all" : location }))}><MapPin size={22} aria-hidden="true" />{location}</button>)}
    {(["Cơm", "Trà sữa", "Ăn vặt"] as const).map((category) => {
      const Icon = category === "Trà sữa" ? CupSoda : category === "Ăn vặt" ? Drumstick : Utensils;
      return <button key={category} type="button" aria-pressed={filters.category === category} onClick={() => onChange((value) => ({ ...value, category: value.category === category ? "all" : category }))}><Icon size={22} aria-hidden="true" />{category}</button>;
    })}
  </div>;
}
