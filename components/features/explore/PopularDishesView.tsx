"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CookingPot,
  CupSoda,
  Drumstick,
  Flame,
  MapPin,
  Sandwich,
  Search,
  Soup,
  Star,
  Tag,
  Utensils,
} from "lucide-react";
import type { PopularDishCard } from "@/lib/explore/popular-data";
import styles from "@/styles/popular-dishes.module.css";
import {
  formatMoney as money,
  normalizeSearchText as normalize,
} from "@/lib/format";

const foodIcons = {
  rice: CookingPot,
  tea: CupSoda,
  noodles: Soup,
  snack: Drumstick,
  bread: Sandwich,
};

const filters = [
  { label: "Cơm", icon: CookingPot },
  { label: "Trà sữa", icon: CupSoda },
  { label: "Ăn vặt", icon: Drumstick },
  { label: "Món Việt", icon: Soup },
  { label: "Món Hàn", icon: Flame },
];

type SortBy = "popular" | "price-asc" | "price-desc" | "name";

export default function PopularDishesView({
  dishes,
}: {
  dishes: PopularDishCard[];
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [under30k, setUnder30k] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("popular");

  function resetFilters() {
    setInput("");
    setQuery("");
    setCategory(null);
    setUnder30k(false);
    setSortBy("popular");
  }

  const results = dishes
    .filter((dish) => {
      const searchable = normalize(
        [dish.name, dish.restaurantName, ...dish.categories].join(" "),
      );

      return (
        searchable.includes(normalize(query)) &&
        (!category || dish.categories.includes(category)) &&
        (!under30k || dish.price < 30000)
      );
    })
    .sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price || a.rank - b.rank;
      if (sortBy === "price-desc") return b.price - a.price || a.rank - b.rank;
      if (sortBy === "name") return a.name.localeCompare(b.name, "vi");
      return a.rank - b.rank;
    });

  return (
    <div className={styles.page}>
      <Link href="/explore" className={styles.back}>
        <ArrowLeft size={20} aria-hidden="true" />
        Khám phá
      </Link>

      <header className={styles.hero}>
        <h1>
          Món phổ biến <span>hôm nay</span>
        </h1>
        <p>Khám phá các món ăn được sinh viên yêu thích.</p>
      </header>

      <form
        className={styles.search}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(input);
        }}
      >
        <Search size={24} aria-hidden="true" />
        <input
          type="search"
          aria-label="Tìm món ăn, quán ăn hoặc loại món"
          placeholder="Tìm món ăn, quán ăn hoặc loại món..."
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            if (!event.target.value) setQuery("");
          }}
        />
        <button type="submit">Tìm kiếm</button>
      </form>

      <div
        className={styles.filters}
        role="group"
        aria-label="Bộ lọc món phổ biến"
      >
        <button
          type="button"
          aria-pressed={!category && !under30k && !query}
          onClick={resetFilters}
        >
          Tất cả
        </button>

        {filters.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            aria-pressed={category === label}
            onClick={() => setCategory(category === label ? null : label)}
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </button>
        ))}

        <button
          type="button"
          aria-pressed={under30k}
          onClick={() => setUnder30k(!under30k)}
        >
          <Tag size={20} aria-hidden="true" />
          Dưới 30.000đ
        </button>

        <button
          type="button"
          aria-pressed={sortBy === "popular"}
          onClick={() => setSortBy("popular")}
        >
          <Star size={20} aria-hidden="true" />
          Phổ biến nhất
        </button>
      </div>

      <section aria-labelledby="popular-results">
        <div className={styles.sectionHeading}>
          <h2 id="popular-results">
            <span className={styles.sectionIcon}>
              <Flame size={23} aria-hidden="true" />
            </span>
            {category || under30k || query
              ? "Món phù hợp"
              : "Tất cả món phổ biến"}
          </h2>

          <div className={styles.sort}>
            <label htmlFor="popular-sort">Sắp xếp:</label>
            <select
              id="popular-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortBy)}
            >
              <option value="popular">Phổ biến nhất</option>
              <option value="price-asc">Giá thấp đến cao</option>
              <option value="price-desc">Giá cao đến thấp</option>
              <option value="name">Tên A–Z</option>
            </select>
          </div>
        </div>

        <p className={styles.resultCount} role="status">
          {results.length} món · Danh sách phổ biến hiện sử dụng dữ liệu mẫu.
        </p>

        {results.length ? (
          <div className={styles.grid}>
            {results.map((dish) => {
              const Icon = foodIcons[dish.kind];

              return (
                <article
                  key={`${dish.restaurantId}/${dish.id}`}
                  className={styles.card}
                >
                  <div className={styles.thumbnail} aria-hidden="true">
                    <Icon size={48} strokeWidth={1.4} />
                  </div>

                  <div className={styles.content}>
                    <h3>{dish.name}</h3>
                    <p className={styles.price}>{money(dish.price)}</p>

                    <p className={styles.meta}>
                      <MapPin size={16} aria-hidden="true" />
                      <span>{dish.restaurantName}</span>
                    </p>

                    <p className={styles.meta}>
                      <Utensils size={16} aria-hidden="true" />
                      <span>{dish.categories.join(", ")}</span>
                    </p>

                    <Link
                      href={dish.href}
                      className={styles.viewButton}
                      aria-label={`Xem món ${dish.name} tại ${dish.restaurantName}`}
                    >
                      Xem món
                      <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>Không tìm thấy món phù hợp.</p>
            <button type="button" onClick={resetFilters}>
              Xóa bộ lọc
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
