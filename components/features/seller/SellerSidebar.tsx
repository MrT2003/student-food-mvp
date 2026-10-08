"use client";

import Link from "next/link";
import { ArrowLeft, ClipboardList, Home, Store, Utensils, Wallet } from "lucide-react";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import styles from "@/styles/seller-orders.module.css";

export default function SellerSidebar({ active, name }: { active: "overview" | "orders"; name: string }) {
  return (
    <aside className={styles.sidebar} aria-label="Quản lý cửa hàng">
      <div className={styles.shop}>
        <FoodThumbnail kind="food" className={styles.shopImage} />
        <div><strong>{name}</strong><span>Seller · Demo</span></div>
      </div>
      <nav>
        <Link href="/seller" aria-current={active === "overview" ? "page" : undefined}><Home />Tổng quan</Link>
        <Link href="/seller/orders" aria-current={active === "orders" ? "page" : undefined}><ClipboardList />Đơn hàng</Link>
        <button disabled title="Chưa triển khai"><Utensils />Menu</button>
        <button disabled title="Chưa triển khai"><Store />Cửa hàng</button>
        <button disabled title="Chưa triển khai"><Wallet />Thanh toán</button>
      </nav>
      <Link className={styles.back} href="/"><ArrowLeft size={18} />Quay lại StudentFood</Link>
    </aside>
  );
}
