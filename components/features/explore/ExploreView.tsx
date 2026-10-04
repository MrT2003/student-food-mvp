"use client";

import {
  ArrowRight,
  Check,
  CookingPot,
  CupSoda,
  Drumstick,
  Flame,
  MapPin,
  Sandwich,
  Search,
  Soup,
  Store,
  Utensils,
} from "lucide-react";
import useExplore, { categories, type SortBy } from "@/lib/explore/useExplore";
import type { FoodKind } from "@/lib/explore/mock-data";
import { popularDishCards } from "@/lib/explore/popular-data";
import styles from "@/styles/explore.module.css";
import Link from "next/link";
import { formatMoney as formatPrice } from "@/lib/format";

const foodIcons = {
  rice: CookingPot,
  tea: CupSoda,
  noodles: Soup,
  snack: Drumstick,
  bread: Sandwich,
};

const categoryIcons = {
  Cơm: Utensils,
  "Trà sữa": CupSoda,
  "Ăn vặt": Drumstick,
  "Món Việt": Soup,
  "Món Hàn": Flame,
};

function FoodPlaceholder({ kind }: { kind: FoodKind }) {
  const Icon = foodIcons[kind];

  return (
    <div className={styles.placeholder} aria-hidden="true">
      <span>
        <Icon size={36} strokeWidth={1.4} />
      </span>
    </div>
  );
}

export default function ExploreView() {
  const explore = useExplore();

  return (
    <div className={styles.explorePage}>
      <section className={styles.hero} aria-labelledby="explore-title">
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
            explore.submitSearch();
          }}
        >
          <Search size={27} strokeWidth={1.7} aria-hidden="true" />

          <input
            type="search"
            aria-label="Tìm quán ăn hoặc món ăn"
            placeholder="Tìm quán ăn hoặc món ăn..."
            value={explore.searchInput}
            onChange={(event) => explore.setSearchInput(event.target.value)}
          />

          <button type="submit" className={styles.primaryButton}>
            Tìm kiếm
          </button>
        </form>

        <div
          className={styles.filters}
          role="group"
          aria-label="Bộ lọc khám phá"
        >
          <button
            type="button"
            aria-pressed={explore.isAllSelected}
            onClick={explore.resetFilters}
          >
            Tất cả
          </button>

          <button
            type="button"
            aria-pressed={explore.openOnly}
            onClick={() => explore.setOpenOnly(!explore.openOnly)}
          >
            <span className={styles.greenDot} aria-hidden="true" />
            Đang mở
          </button>

          {(["KTX A", "KTX B"] as const).map((location) => (
            <button
              type="button"
              key={location}
              aria-pressed={explore.location === location}
              onClick={() =>
                explore.setLocation(
                  explore.location === location ? "all" : location,
                )
              }
            >
              <MapPin size={22} aria-hidden="true" />
              {location}
            </button>
          ))}

          {categories.map((category) => {
            const Icon = categoryIcons[category];

            return (
              <button
                type="button"
                key={category}
                aria-pressed={explore.category === category}
                onClick={() =>
                  explore.setCategory(
                    explore.category === category ? null : category,
                  )
                }
              >
                <Icon size={22} aria-hidden="true" />
                {category}
              </button>
            );
          })}
        </div>
      </section>

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
              value={explore.sortBy}
              onChange={(event) =>
                explore.setSortBy(event.target.value as SortBy)
              }
            >
              <option value="popular">Phổ biến</option>
              <option value="name">Tên A–Z</option>
              <option value="menu">Nhiều món nhất</option>
            </select>
          </div>
        </div>

        <p className={styles.srOnly} role="status">
          Tìm thấy {explore.restaurants.length} quán.
        </p>

        {explore.restaurants.length > 0 ? (
          <div className={styles.restaurantGrid}>
            {explore.restaurants.map((restaurant) => (
              <article className={styles.restaurantCard} key={restaurant.id}>
                <FoodPlaceholder kind={restaurant.kind} />

                <div className={styles.restaurantContent}>
                  <div className={styles.restaurantTop}>
                    <h3>{restaurant.name}</h3>

                    <span
                      className={`${styles.openBadge} ${
                        !restaurant.isOpen ? styles.closedBadge : ""
                      }`}
                    >
                      <Check size={12} aria-hidden="true" />
                      {restaurant.isOpen ? "Đang mở" : "Đã đóng"}
                    </span>
                  </div>

                  <p className={styles.location}>
                    <MapPin size={17} aria-hidden="true" />
                    {restaurant.location}
                  </p>

                  <div className={styles.meta}>
                    <span>
                      <Store size={15} aria-hidden="true" />
                      {restaurant.menuCount} món
                    </span>

                    <span title={restaurant.categories.join(", ")}>
                      <Utensils size={15} aria-hidden="true" />
                      <span>{restaurant.categories.join(", ")}</span>
                    </span>
                  </div>

                  <Link
                    href={`/restaurants/${restaurant.id}`}
                    className={styles.primaryButton}
                    aria-label={`Xem quán ${restaurant.name}`}
                  >
                    Xem quán
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>Không tìm thấy quán phù hợp.</p>
            <button type="button" onClick={explore.resetFilters}>
              Xóa bộ lọc
            </button>
          </div>
        )}
      </section>

      <section
        className={styles.popular}
        aria-labelledby="popular-dishes-title"
      >
        <div className={styles.sectionHeading}>
          <h2 id="popular-dishes-title">
            <span className={styles.sectionIcon}>
              <Flame size={24} aria-hidden="true" />
            </span>
            Món phổ biến hôm nay
          </h2>

          <Link href="/explore/popular" className={styles.seeAll}>
            Xem tất cả
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </div>

        <div className={styles.dishGrid}>
          {popularDishCards.slice(0, 6).map((dish) => (
            <article
              key={`${dish.restaurantId}/${dish.id}`}
              className={styles.dishCard}
            >
              <FoodPlaceholder kind={dish.kind} />

              <div className={styles.dishContent}>
                <h3>{dish.name}</h3>

                <p className={styles.price}>{formatPrice(dish.price)}</p>

                <p className={styles.restaurantName}>{dish.restaurantName}</p>

                <Link
                  href={dish.href}
                  className={styles.outlineButton}
                  aria-label={`Xem món ${dish.name} tại ${dish.restaurantName}`}
                >
                  Xem món
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
