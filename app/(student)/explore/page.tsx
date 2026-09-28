import type { Metadata } from "next";
import ExploreView from "@/components/features/explore/ExploreView";

export const metadata: Metadata = {
  title: "Khám phá | StudentFood",
  description: "Khám phá các quán ăn và món ngon quanh khu ký túc xá.",
};

export default function ExplorePage() {
  return <ExploreView />;
}