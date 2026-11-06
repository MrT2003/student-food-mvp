"use client";

import { useHome } from "@/lib/home/useHome";
import type { PreviewRestaurant } from "@/lib/home/mock-data";
import HomeHero from "./HomeHero";
import HomeFilters from "./HomeFilters";
import RestaurantSection from "./RestaurantSection";
import ReorderSection from "./ReorderSection";
import { useRouter } from "next/navigation";

export default function HomeView({
  initialRestaurants,
}: {
  initialRestaurants?: PreviewRestaurant[];
}) {
  const router = useRouter();
  const home = useHome(initialRestaurants);

  return (
    <>
      <HomeHero
        input={home.input}
        onChange={home.setInput}
        onSearch={home.search}
      />
      <HomeFilters
        filters={home.filters}
        onChange={home.setFilters}
        onReset={home.reset}
      />
      <RestaurantSection
        restaurants={home.restaurants}
        onSelect={(restaurant) => {
          if (!restaurant.slug) return;

          router.push(`/restaurants/${encodeURIComponent(restaurant.slug)}`);
        }}
        onReset={home.reset}
        searching={Boolean(home.filters.query)}
        compact={home.isAllSelected}
      />
      <ReorderSection />
    </>
  );
}
