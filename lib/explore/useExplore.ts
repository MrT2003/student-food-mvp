"use client";

import { useMemo, useState } from "react";
import { exploreRestaurants, popularDishes } from "./mock-data";
import { normalizeSearchText as normalize } from "@/lib/format";

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
export default function useExplore() {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [location, setLocation] = useState<Location>("all");
  const [category, setCategory] = useState<Category | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("popular");

  const restaurants = useMemo(() => {
    const search = normalize(query);

    const result = exploreRestaurants.filter((restaurant) => {
      if (openOnly && !restaurant.isOpen) return false;

      if (location !== "all" && restaurant.location !== location) {
        return false;
      }

      if (category && !restaurant.categories.includes(category)) {
        return false;
      }

      // Tìm được cả theo tên quán và tên món mẫu của quán.
      const dishNames = popularDishes
        .filter((dish) => dish.restaurantId === restaurant.id)
        .map((dish) => dish.name);

      const searchableText = normalize(
        [
          restaurant.name,
          restaurant.location,
          ...restaurant.categories,
          ...dishNames,
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
  }, [query, openOnly, location, category, sortBy]);

  function resetFilters() {
    setSearchInput("");
    setQuery("");
    setOpenOnly(false);
    setLocation("all");
    setCategory(null);
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
    isAllSelected:
      !query.trim() && !openOnly && location === "all" && category === null,
  };
}
