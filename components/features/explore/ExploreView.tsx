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
  const explore = useExplore(initialRestaurants);

  return (
    <div className={styles.explorePage}>
      <section className={styles.hero} aria-labelledby="explore-title">
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
      </section>

      <ExploreResultsSection
        restaurants={explore.restaurants}
        sortBy={explore.sortBy}
        onSortChange={explore.setSortBy}
        onResetFilters={explore.resetFilters}
        compact={explore.isAllSelected}
      />

      <PopularDishesSection dishes={initialPopularDishes} />
    </div>
  );
}
