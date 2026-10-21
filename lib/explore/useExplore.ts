"use client";

import { useMemo, useState } from "react";
import { normalizeSearchText as normalize } from "@/lib/format";
import { exploreRestaurants, type ExploreRestaurant } from "./mock-data";

export const categories = [
  "Cơm",
  "Trà sữa",
  "Ăn vặt",
  "Món Việt",
  "Món Hàn",
] as const;

export type Category = (typeof categories)[number];
export type Location = "all" | "KTX A" | "KTX B";
export type SortBy = "popular" | "name" | "menu";

export type ExploreFilters = {
  query: string;
  openOnly: boolean;
  location: Location;
  category: Category | null;
  sortBy: SortBy;
};

export const initialExploreFilters: ExploreFilters = {
  query: "",
  openOnly: false,
  location: "all",
  category: null,
  sortBy: "popular",
};

export function isAllExploreFilters(
  filters: Pick<ExploreFilters, "query" | "openOnly" | "location" | "category">,
): boolean {
  return (
    !filters.query.trim() &&
    !filters.openOnly &&
    filters.location === "all" &&
    filters.category === null
  );
}

export function filterAndSortExploreRestaurants(
  list: ExploreRestaurant[],
  filters: Partial<ExploreFilters> = initialExploreFilters,
): ExploreRestaurant[] {
  const query = filters.query ?? initialExploreFilters.query;
  const openOnly = filters.openOnly ?? initialExploreFilters.openOnly;
  const location = filters.location ?? initialExploreFilters.location;
  const category =
    filters.category === undefined
      ? initialExploreFilters.category
      : filters.category;
  const sortBy = filters.sortBy ?? initialExploreFilters.sortBy;
  const search = normalize(query);

  const result = list.filter((restaurant) => {
    if (openOnly && !restaurant.isOpen) return false;

    if (location !== "all" && restaurant.location !== location) {
      return false;
    }

    if (category && !restaurant.categories.includes(category)) {
      return false;
    }

    const searchableText = normalize(
      [
        restaurant.name,
        restaurant.location,
        ...restaurant.categories,
        ...restaurant.searchTerms,
      ].join(" "),
    );

    return searchableText.includes(search);
  });

  return result.sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name, "vi");
    }

    if (sortBy === "menu") {
      return b.menuCount - a.menuCount;
    }

    return b.popularity - a.popularity;
  });
}

export function useExplore(
  initialRestaurants: ExploreRestaurant[] = exploreRestaurants,
) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState(initialExploreFilters.query);
  const [openOnly, setOpenOnly] = useState(initialExploreFilters.openOnly);
  const [location, setLocation] = useState<Location>(
    initialExploreFilters.location,
  );
  const [category, setCategory] = useState<Category | null>(
    initialExploreFilters.category,
  );
  const [sortBy, setSortBy] = useState<SortBy>(initialExploreFilters.sortBy);

  const restaurants = useMemo(
    () =>
      filterAndSortExploreRestaurants(initialRestaurants, {
        query,
        openOnly,
        location,
        category,
        sortBy,
      }),
    [query, openOnly, location, category, sortBy, initialRestaurants],
  );

  function resetFilters() {
    setSearchInput("");
    setQuery(initialExploreFilters.query);
    setOpenOnly(initialExploreFilters.openOnly);
    setLocation(initialExploreFilters.location);
    setCategory(initialExploreFilters.category);
  }

  return {
    searchInput,
    setSearchInput,
    submitSearch: () => setQuery(searchInput),
    openOnly,
    setOpenOnly,
    location,
    setLocation,
    category,
    setCategory,
    sortBy,
    setSortBy,
    restaurants,
    resetFilters,
    isAllSelected: isAllExploreFilters({
      query,
      openOnly,
      location,
      category,
    }),
  };
}

export default useExplore;
