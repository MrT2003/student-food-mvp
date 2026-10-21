"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CompassActiveIcon,
  CompassInactiveIcon,
  HomeActiveIcon,
  HomeInactiveIcon,
  OrderActiveIcon,
  OrderInactiveIcon,
  UserActiveIcon,
  UserInactiveIcon,
} from "@/components/BottomNavIcons";
import styles from "@/styles/student-mobile-navigation.module.css";

const destinations = [
  {
    href: "/",
    label: "Trang chủ",
    activeIcon: HomeActiveIcon,
    inactiveIcon: HomeInactiveIcon,
  },
  {
    href: "/explore",
    label: "Khám phá",
    activeIcon: CompassActiveIcon,
    inactiveIcon: CompassInactiveIcon,
  },
  {
    href: "/orders",
    label: "Đơn hàng",
    activeIcon: OrderActiveIcon,
    inactiveIcon: OrderInactiveIcon,
  },
  {
    href: "/account",
    label: "Tài khoản",
    activeIcon: UserActiveIcon,
    inactiveIcon: UserInactiveIcon,
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  if (href === "/explore") return pathname.startsWith("/restaurants/");
  if (href === "/orders") return pathname === "/cart/success";
  if (href === "/account") return pathname === "/seller/register";
  return false;
}

export default function StudentBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.navigation} aria-label="Điều hướng chính trên điện thoại">
      {destinations.map(({ href, label, activeIcon: ActiveIcon, inactiveIcon: InactiveIcon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={styles.link}
            aria-current={active ? "page" : undefined}
          >
            {active ? (
              <ActiveIcon aria-hidden="true" />
            ) : (
              <InactiveIcon aria-hidden="true" />
            )}
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
