import { Search } from "lucide-react";
import styles from "@/styles/explore.module.css";

type Props = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSubmitSearch: () => void;
};

export default function ExploreHero({
  searchInput,
  onSearchInputChange,
  onSubmitSearch,
}: Props) {
  return (
    <>
      <h1 id="explore-title">
        Khám phá món ngon quanh <span>khu ký túc xá</span>
      </h1>

      <p>
        Khám phá các quán ăn ngon, đa dạng món ăn và ưu đãi hấp dẫn dành riêng
        cho sinh viên.
      </p>

      <form
        role="search"
        className={styles.search}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitSearch();
        }}
      >
        <Search size={27} strokeWidth={1.7} aria-hidden="true" />

        <input
          type="search"
          aria-label="Tìm quán ăn hoặc món ăn"
          placeholder="Tìm quán ăn hoặc món ăn..."
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
        />

        <button type="submit" className={styles.primaryButton}>
          Tìm kiếm
        </button>
      </form>
    </>
  );
}
