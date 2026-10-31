"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import styles from "@/styles/seller-mobile-navigation.module.css";

export type SellerNavKey = "overview" | "orders" | "menu" | "shop" | "payments";

export const sellerNavDestinations = [
  {
    key: "overview" as const,
    href: "/seller",
    label: "Tổng quan",
    activeIcon: SellerHomeActiveIcon,
    inactiveIcon: SellerHomeInactiveIcon,
  },
  {
    key: "orders" as const,
    href: "/seller/orders",
    label: "Đơn hàng",
    activeIcon: SellerOrderActiveIcon,
    inactiveIcon: SellerOrderInactiveIcon,
  },
  {
    key: "menu" as const,
    href: "/seller/menu",
    label: "Menu",
    activeIcon: SellerMenuActiveIcon,
    inactiveIcon: SellerMenuInactiveIcon,
  },
  {
    key: "shop" as const,
    href: "/seller/shop",
    label: "Cửa hàng",
    activeIcon: SellerStoreActiveIcon,
    inactiveIcon: SellerStoreInactiveIcon,
  },
] as const;

export function isSellerNavActive(
  pathname: string | null | undefined,
  href: string,
  activeKey?: SellerNavKey,
  itemKey?: SellerNavKey,
): boolean {
  if (activeKey && itemKey) {
    if (activeKey === itemKey) return true;
    if (activeKey === "payments" && itemKey === "shop") return false;
    return false;
  }

  const currentPath = pathname || "/seller";
  if (href === "/seller") {
    return currentPath === "/seller";
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export default function SellerBottomNavigation({
  active,
}: {
  active?: SellerNavKey;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={styles.navigation}
      aria-label="Điều hướng quản lý cửa hàng trên điện thoại"
    >
      {sellerNavDestinations.map(
        ({
          key,
          href,
          label,
          activeIcon: ActiveIcon,
          inactiveIcon: InactiveIcon,
        }) => {
          const isCurrent = isSellerNavActive(pathname, href, active, key);
          return (
            <Link
              key={href}
              href={href}
              className={styles.link}
              aria-current={isCurrent ? "page" : undefined}
            >
              {isCurrent ? (
                <ActiveIcon aria-hidden="true" />
              ) : (
                <InactiveIcon aria-hidden="true" />
              )}
              <span>{label}</span>
            </Link>
          );
        },
      )}
    </nav>
  );
}
