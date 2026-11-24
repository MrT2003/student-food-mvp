"use client";

import { useHome } from "@/lib/home/useHome";
import type { PreviewRestaurant } from "@/lib/home/mock-data";
import HomeHero from "./HomeHero";
import HomeFilters from "./HomeFilters";
import RestaurantSection from "./RestaurantSection";
import ReorderSection from "./ReorderSection";
import { useRouter } from "next/navigation";
import styles from "@/styles/home.module.css";

export default function HomeView({
  initialRestaurants,
}: {
  initialRestaurants?: PreviewRestaurant[];
}) {
  const router = useRouter();
  const home = useHome(initialRestaurants);

  return (
    <>
      <div className={styles.heroBanner}>
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
            {/* Hơi ấm bốc lên */}
            <path d="M40 36c-3-6 3-11 0-17" />
            <path d="M56 32c-3-6 3-11 0-17" />
            <path d="M72 36c-3-6 3-11 0-17" />
            {/* Đũa gác chéo nhẹ */}
            <path d="M68 48l36-22" />
            <path d="M74 52l34-16" />
            {/* Viền tô phở / mì */}
            <ellipse cx="58" cy="56" rx="38" ry="10" />
            {/* Sợi mì & topping trong tô */}
            <path d="M32 56c8-5 16-5 24 0s16 5 26-1" />
            <circle cx="46" cy="54" r="3" />
            <circle cx="67" cy="55" r="3.5" />
            {/* Thân tô và đế tô */}
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
            {/* Ống hút và nắp ly trà sữa */}
            <path d="M54 14l-6 30" />
            <path d="M28 44c0-11 10-20 22-20s22 9 22 20" />
            <rect x="24" y="44" width="52" height="7" rx="3.5" />
            {/* Thân ly trà sữa & trân châu */}
            <path d="M29 51l5 49a6 6 0 0 0 6 5h20a6 6 0 0 0 6-5l5-49" />
            <path d="M32 68c9 3 18-3 28 0s9 3 8 0" />
            <circle cx="42" cy="91" r="3" />
            <circle cx="51" cy="95" r="3" />
            <circle cx="59" cy="90" r="3" />
            {/* Ổ bánh mì bên cạnh */}
            <path d="M62 96c2-15 16-27 33-28 9 0 15 5 15 12-1 15-16 26-34 26-9 0-15-4-14-10z" />
            <path d="M77 77l7 10" />
            <path d="M88 73l6 10" />
            <path d="M98 73l4 8" />
          </svg>
        </span>
        <div className={styles.heroBannerContent}>
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
        </div>
      </div>
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
