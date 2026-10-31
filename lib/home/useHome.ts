"use client";
import { useMemo, useState } from "react";
import { previewRestaurants, type PreviewRestaurant } from "./mock-data";
import type { HomeFilters } from "@/types/home.types";
import { normalizeSearchText as normalize } from "@/lib/format";

export const initialHomeFilters: HomeFilters = {
  query: "",
  openOnly: false,
  location: "all",
  category: "all",
};

export function isAllHomeFilters(filters: HomeFilters): boolean {
  return (
    !filters.query.trim() &&
    !filters.openOnly &&
    filters.location === "all" &&
    filters.category === "all"
  );
}

export function filterHomeRestaurants(
  list: PreviewRestaurant[],
  filters: HomeFilters,
): PreviewRestaurant[] {
  const query = normalize(filters.query);

  return list.filter((restaurant) => {
    const text = normalize(
      [
        restaurant.name,
        restaurant.location ?? "",
        ...restaurant.categories,
        ...restaurant.searchTerms,
      ].join(" "),
    );
    return (
      text.includes(query) &&
      (!filters.openOnly || restaurant.operating_status === "open") &&
      (filters.location === "all" ||
        restaurant.location === filters.location) &&
      (filters.category === "all" ||
        restaurant.categories.includes(filters.category))
    );
  });
}

export function useHome(
  initialRestaurants: PreviewRestaurant[] = previewRestaurants,
) {
  const [input, setInput] = useState("");
  const [filters, setFilters] = useState<HomeFilters>(initialHomeFilters);
  const [selected, setSelected] = useState<PreviewRestaurant | null>(null);
  const restaurants = useMemo(
    () => filterHomeRestaurants(initialRestaurants, filters),
    [initialRestaurants, filters],
  );
  function reset() {
    setInput("");
    setFilters(initialHomeFilters);
  }
  return {
    input,
    setInput,
    filters,
    setFilters,
    restaurants,
    recentRestaurants: initialRestaurants,
    isAllSelected: isAllHomeFilters(filters),
    selected,
    setSelected,
    reset,
    search: () => setFilters((current) => ({ ...current, query: input })),
  };
}
