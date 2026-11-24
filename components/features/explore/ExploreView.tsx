"use client";

import useExplore from "@/lib/explore/useExplore";
import type { ExploreRestaurant } from "@/lib/explore/mock-data";
import {
  popularDishCards,
  type PopularDishCard,
} from "@/lib/explore/popular-data";
import ExploreHero from "./ExploreHero";
import ExploreFilters from "./ExploreFilters";
import ExploreResultsSection from "./ExploreResultsSection";
import PopularDishesSection from "./PopularDishesSection";
import styles from "@/styles/explore.module.css";

export default function ExploreView({
  initialRestaurants,
  initialPopularDishes = popularDishCards,
}: {
  initialRestaurants?: ExploreRestaurant[];
  initialPopularDishes?: PopularDishCard[];
}) {
  const explore = useExplore(initialRestaurants, initialPopularDishes);

  return (
    <div className={styles.explorePage}>
      <section className={styles.hero} aria-labelledby="explore-title">
        <span className={styles.heroDecorLeft} aria-hidden="true">
          <svg
            width="124"
            height="124"
            viewBox="0 0 124 124"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M40 36c-3-6 3-11 0-17" />
            <path d="M56 32c-3-6 3-11 0-17" />
            <path d="M72 36c-3-6 3-11 0-17" />
            <path d="M68 48l36-22" />
            <path d="M74 52l34-16" />
            <ellipse cx="58" cy="56" rx="38" ry="10" />
            <path d="M32 56c8-5 16-5 24 0s16 5 26-1" />
            <circle cx="46" cy="54" r="3" />
            <circle cx="67" cy="55" r="3.5" />
            <path d="M20 56c0 24 17 40 38 40s38-16 38-40" />
            <path d="M41 94l-3 9h40l-3-9" />
            <path d="M34 69c7 6 15 9 24 9" />
          </svg>
        </span>
        <span className={styles.heroDecorRight} aria-hidden="true">
          <svg
            width="124"
            height="124"
            viewBox="0 0 124 124"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M54 14l-6 30" />
            <path d="M28 44c0-11 10-20 22-20s22 9 22 20" />
            <rect x="24" y="44" width="52" height="7" rx="3.5" />
            <path d="M29 51l5 49a6 6 0 0 0 6 5h20a6 6 0 0 0 6-5l5-49" />
            <path d="M32 68c9 3 18-3 28 0s9 3 8 0" />
            <circle cx="42" cy="91" r="3" />
            <circle cx="51" cy="95" r="3" />
            <circle cx="59" cy="90" r="3" />
            <path d="M62 96c2-15 16-27 33-28 9 0 15 5 15 12-1 15-16 26-34 26-9 0-15-4-14-10z" />
            <path d="M77 77l7 10" />
            <path d="M88 73l6 10" />
            <path d="M98 73l4 8" />
          </svg>
        </span>
        <div className={styles.heroBannerContent}>
          <ExploreHero
            searchInput={explore.searchInput}
            onSearchInputChange={explore.setSearchInput}
            onSubmitSearch={explore.submitSearch}
          />

          <ExploreFilters
            isAllSelected={explore.isAllSelected}
            openOnly={explore.openOnly}
            location={explore.location}
            category={explore.category}
            onReset={explore.resetFilters}
            onToggleOpenOnly={() => explore.setOpenOnly(!explore.openOnly)}
            onSelectLocation={explore.setLocation}
            onSelectCategory={explore.setCategory}
          />
        </div>
      </section>

      <ExploreResultsSection
        dishes={explore.dishes}
        sortBy={explore.sortBy}
        onSortChange={explore.setSortBy}
        onResetFilters={explore.resetFilters}
        compact={explore.isAllSelected}
      />

      <PopularDishesSection dishes={initialPopularDishes} />
    </div>
  );
}
