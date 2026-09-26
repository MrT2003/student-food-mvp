"use client";
import { useMemo, useState } from "react";
import { previewRestaurants, type PreviewRestaurant } from "./mock-data";
import type { HomeFilters } from "@/types/home.types";

const initialFilters: HomeFilters = { query: "", openOnly: false, location: "all", category: "all" };
function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
}
export function useHome() {
  const [input, setInput] = useState("");
  const [filters, setFilters] = useState<HomeFilters>(initialFilters);
  const [selected, setSelected] = useState<PreviewRestaurant | null>(null);
  const restaurants = useMemo(() => previewRestaurants.filter((restaurant) => {
    const text = normalize([restaurant.name, ...restaurant.categories, ...restaurant.searchTerms].join(" "));
    return text.includes(normalize(filters.query)) &&
      (!filters.openOnly || restaurant.operating_status === "open") &&
      (filters.location === "all" || restaurant.location === filters.location) &&
      (filters.category === "all" || restaurant.categories.includes(filters.category));
  }), [filters]);
  function reset() { setInput(""); setFilters(initialFilters); }
  return { input, setInput, filters, setFilters, restaurants, recentRestaurants: previewRestaurants, selected, setSelected, reset,
    search: () => setFilters((current) => ({ ...current, query: input })) };
}
