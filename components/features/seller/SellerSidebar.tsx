"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Wallet } from "lucide-react";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import Image from "@/components/media/AppImage";
import { createClient } from "@/lib/supabase/client";
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
  const shopId = shop?.id;
  const isStaff = data?.user.role === "staff";
  const [fetchedPendingCount, setFetchedPendingCount] = useState(0);

  useEffect(() => {
    if (!shopId || typeof pendingOrderCount === "number") return;

    let active = true;
    const supabase = createClient();

    async function refreshPendingCount() {
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", shopId)
        .eq("order_status", "pending");

      if (active && !error && typeof count === "number") {
        setFetchedPendingCount(count);
      }
    }

    void refreshPendingCount();

    const channel = supabase
      .channel(`seller-pending-orders:${shopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${shopId}`,
        },
        () => {
          void refreshPendingCount();
        },
      )
      .subscribe();

    const refreshIfVisible = () => {
      if (document.visibilityState !== "hidden" && navigator.onLine !== false) {
        void refreshPendingCount();
      }
    };

    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      void supabase.removeChannel(channel);
    };
  }, [shopId, pendingOrderCount]);

  const resolvedPendingCount =
    typeof pendingOrderCount === "number"
      ? pendingOrderCount
      : shopId
        ? fetchedPendingCount
        : 0;

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
            <span>Đơn hàng</span>
            {resolvedPendingCount > 0 && (
              <span
                className={styles.navBadge}
                data-testid="seller-orders-sidebar-badge"
                aria-label={`${resolvedPendingCount} đơn chờ xác nhận`}
              >
                {resolvedPendingCount > 99 ? "99+" : resolvedPendingCount}
              </span>
            )}
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
        pendingOrderCount={resolvedPendingCount}
        menuLabel={menuLabel}
      />
    </>
  );
}

