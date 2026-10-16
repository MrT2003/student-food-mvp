// import CartTestPanel from "@/components/buttons/addToCartBtn";
// import OrderTestPanel from "@/components/buttons/orderTestPanel";
import HomeView from "@/components/features/home/HomeView";
// import HomeView from "@/components/features/home/HomeView";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Trang chủ | StudentFood",
  description: "Khám phá các quán ăn quanh khu ký túc xá.",
};

export default function HomePage() {
  return <HomeView/>;
}

