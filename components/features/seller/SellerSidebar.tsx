"use client";

import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import Image from "next/image";
import { useSellerShopStore } from "@/store/useSellerShopStore";
import {
  SellerHomeActiveIcon,
  SellerHomeInactiveIcon,
  SellerMenuActiveIcon,
  SellerMenuInactiveIcon,
  SellerOrderActiveIcon,
  SellerOrderInactiveIcon,
  SellerStoreActiveIcon,
  SellerStoreInactiveIcon,
} from "@/components/ui/SellerBottomNavIcons";
import SellerBottomNavigation from "./SellerBottomNavigation";
import styles from "@/styles/seller-orders.module.css";

export default function SellerSidebar({
  active,
  name,
  pendingOrderCount,
  menuLabel,
}: {
  active: "overview" | "orders" | "menu" | "shop" | "payments";
  name: string;
  pendingOrderCount?: number;
  menuLabel?: string;
}) {
  const shop = useSellerShopStore((state) => state.shop);
  return (
    <>
      <aside className={styles.sidebar} aria-label="Quản lý cửa hàng">
        <div className={styles.shop}>
          {shop?.avatar_url ? <Image src={shop.avatar_url} alt="Ảnh cửa hàng" width={60} height={60} unoptimized className={styles.shopImage} style={{ objectFit: "cover" }} /> : <FoodThumbnail kind="food" className={styles.shopImage} />}
          <div><strong>{shop?.name || name}</strong><span>Seller · Demo</span></div>
        </div>
        <nav>
          <Link href="/seller" aria-current={active === "overview" ? "page" : undefined}>
            {active === "overview" ? <SellerHomeActiveIcon aria-hidden="true" /> : <SellerHomeInactiveIcon aria-hidden="true" />}
            Tổng quan
          </Link>
          <Link href="/seller/orders" aria-current={active === "orders" ? "page" : undefined}>
            {active === "orders" ? <SellerOrderActiveIcon aria-hidden="true" /> : <SellerOrderInactiveIcon aria-hidden="true" />}
            Đơn hàng
          </Link>
          <Link href="/seller/menu" aria-current={active === "menu" ? "page" : undefined}>
            {active === "menu" ? <SellerMenuActiveIcon aria-hidden="true" /> : <SellerMenuInactiveIcon aria-hidden="true" />}
            Menu
          </Link>
          <Link href="/seller/shop" aria-current={active === "shop" ? "page" : undefined}>
            {active === "shop" ? <SellerStoreActiveIcon aria-hidden="true" /> : <SellerStoreInactiveIcon aria-hidden="true" />}
            Cửa hàng
          </Link>
          <Link href="/seller/payments" aria-current={active === "payments" ? "page" : undefined}><Wallet />Thanh toán</Link>
        </nav>
        <Link className={styles.back} href="/"><ArrowLeft size={18} />Quay lại StudentFood</Link>
      </aside>
      <SellerBottomNavigation
        active={active}
        pendingOrderCount={pendingOrderCount}
        menuLabel={menuLabel}
      />
    </>
  );
}
