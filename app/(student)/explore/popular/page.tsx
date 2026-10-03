import type { Metadata } from "next";
import PopularDishesView from "@/components/features/explore/PopularDishesView";
import { popularDishCards } from "@/lib/explore/popular-data";

export const metadata: Metadata = {
  title: "Món phổ biến hôm nay | StudentFood",
  description: "Khám phá các món ăn phổ biến trên StudentFood.",
};

export default function PopularDishesPage() {
  return <PopularDishesView dishes={popularDishCards} />;
}
