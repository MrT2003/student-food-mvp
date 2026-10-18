"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Compass, House, UserRound } from "lucide-react";
import styles from "@/styles/student-mobile-navigation.module.css";

const destinations = [
  { href: "/", label: "Trang chủ", icon: House },
  { href: "/explore", label: "Khám phá", icon: Compass },
  { href: "/orders", label: "Đơn hàng", icon: ClipboardList },
  { href: "/account", label: "Tài khoản", icon: UserRound },
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
      {destinations.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={styles.link}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              size={25}
              strokeWidth={active ? 2.2 : 1.7}
              fill={active && href === "/" ? "currentColor" : "none"}
              aria-hidden="true"
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
