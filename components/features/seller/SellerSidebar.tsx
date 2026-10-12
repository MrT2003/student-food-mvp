"use client";

import Link from "next/link";
import { ArrowLeft, ClipboardList, Home, Store, Utensils, Wallet } from "lucide-react";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import Image from "next/image";
import { useSellerShopStore } from "@/store/useSellerShopStore";
import styles from "@/styles/seller-orders.module.css";

export default function SellerSidebar({ active, name }: { active: "overview" | "orders" | "menu" | "shop" | "payments"; name: string }) {
  const shop = useSellerShopStore((state) => state.shop);
  return (
    <aside className={styles.sidebar} aria-label="Quản lý cửa hàng">
      <div className={styles.shop}>
        {shop?.avatar_url ? <Image src={shop.avatar_url} alt="Ảnh cửa hàng" width={60} height={60} unoptimized className={styles.shopImage} style={{ objectFit: "cover" }} /> : <FoodThumbnail kind="food" className={styles.shopImage} />}
        <div><strong>{shop?.name || name}</strong><span>Seller · Demo</span></div>
      </div>
      <nav>
        <Link href="/seller" aria-current={active === "overview" ? "page" : undefined}><Home />Tổng quan</Link>
        <Link href="/seller/orders" aria-current={active === "orders" ? "page" : undefined}><ClipboardList />Đơn hàng</Link>
        <Link href="/seller/menu" aria-current={active === "menu" ? "page" : undefined}><Utensils />Menu</Link>
        <Link href="/seller/shop" aria-current={active === "shop" ? "page" : undefined}><Store />Cửa hàng</Link>
        <Link href="/seller/payments" aria-current={active === "payments" ? "page" : undefined}><Wallet />Thanh toán</Link>
      </nav>
      <Link className={styles.back} href="/"><ArrowLeft size={18} />Quay lại StudentFood</Link>
    </aside>
  );
}
