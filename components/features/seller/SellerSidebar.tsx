"use client";

import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import Image from "next/image";
import { useSellerAccess } from "./SellerAccessProvider";
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
  pendingOrderCount,
  menuLabel,
}: {
  active: "overview" | "orders" | "menu" | "shop" | "payments";
  name: string;
  pendingOrderCount?: number;
  menuLabel?: string;
}) {
  const { data } = useSellerAccess();
  const shop = data?.restaurant;
  const isStaff = data?.user.role === "staff";
  const allowedTabs =
    Array.isArray(data?.allowed_tabs) && data.allowed_tabs.length > 0
      ? data.allowed_tabs
      : isStaff
        ? (["overview", "orders", "shop"] as const)
        : (["overview", "orders", "menu", "shop", "payments"] as const);
  const canView = (tab: "overview" | "orders" | "menu" | "shop" | "payments") =>
    (allowedTabs as readonly string[]).includes(tab);
  return (
    <>
      <aside className={styles.sidebar} aria-label="Quản lý cửa hàng">
        <div className={styles.shop}>
          {shop?.avatar_url ? <Image src={shop.avatar_url} alt="Ảnh cửa hàng" width={60} height={60} unoptimized className={styles.shopImage} style={{ objectFit: "cover" }} /> : <FoodThumbnail kind="food" className={styles.shopImage} />}
          <div><strong>{shop?.name || "Đang tải cửa hàng…"}</strong><span>{isStaff ? "Nhân viên (Staff)" : "Seller"}</span></div>
        </div>
        <nav>
          {canView("overview") && <Link href="/seller" aria-current={active === "overview" ? "page" : undefined}>
            {active === "overview" ? <SellerHomeActiveIcon aria-hidden="true" /> : <SellerHomeInactiveIcon aria-hidden="true" />}
            Tổng quan
          </Link>}
          {canView("orders") && <Link href="/seller/orders" aria-current={active === "orders" ? "page" : undefined}>
            {active === "orders" ? <SellerOrderActiveIcon aria-hidden="true" /> : <SellerOrderInactiveIcon aria-hidden="true" />}
            Đơn hàng
          </Link>}
          {canView("menu") && <Link href="/seller/menu" aria-current={active === "menu" ? "page" : undefined}>
            {active === "menu" ? <SellerMenuActiveIcon aria-hidden="true" /> : <SellerMenuInactiveIcon aria-hidden="true" />}
            Menu
          </Link>}
          {canView("shop") && <Link href="/seller/shop" aria-current={active === "shop" ? "page" : undefined}>
            {active === "shop" ? <SellerStoreActiveIcon aria-hidden="true" /> : <SellerStoreInactiveIcon aria-hidden="true" />}
            Cửa hàng
          </Link>}
          {canView("payments") && <Link href="/seller/payments" aria-current={active === "payments" ? "page" : undefined}><Wallet />Thanh toán</Link>}
        </nav>
        <Link className={styles.back} href="/"><ArrowLeft size={18} />Quay lại StudentFood</Link>
      </aside>
      <SellerBottomNavigation
        active={active}
        isStaff={isStaff}
        allowedTabs={allowedTabs}
        pendingOrderCount={pendingOrderCount}
        menuLabel={menuLabel}
      />
    </>
  );
}
