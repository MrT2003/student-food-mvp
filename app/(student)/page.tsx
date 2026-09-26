import type { Metadata } from "next";
import HomeView from "@/components/features/home/HomeView";

export const metadata: Metadata = {
  title: "Trang chủ | StudentFood",
  description: "Khám phá các quán ăn quanh khu ký túc xá.",
};

export default function HomePage() {
  return <HomeView />;
}