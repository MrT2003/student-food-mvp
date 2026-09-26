"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, ShoppingCart, Utensils } from "lucide-react";
import { previewAccount } from "@/lib/home/mock-data";
import { AccountDropdown, NotificationDropdown } from "./HeaderDropdowns";
import {
  headerNotifications,
  type HeaderNotification,
} from "./header-preview-data";
import dropdownStyles from "./header-dropdowns.module.css";
import styles from "@/components/features/home/home.module.css";
import { usePathname } from "next/navigation";

type Panel = "notifications" | "account" | null;

export default function StudentHeader() {
  const pathname = usePathname();
  const [panel, setPanel] = useState<Panel>(null);
  const [notifications, setNotifications] = useState<HeaderNotification[]>(() =>
    headerNotifications.map((item) => ({ ...item })),
  );
  const unreadCount = notifications.filter((item) => item.unread).length;
  const actions = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !actions.current?.contains(event.target)
      )
        setPanel(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel(null);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  function toggle(next: Panel) {
    setPanel((current) => (current === next ? null : next));
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link
          href="/"
          className={styles.brand}
          aria-label="StudentFood - Trang chủ"
        >
          <span className={styles.brandIcon}>
            <Utensils size={31} strokeWidth={2} aria-hidden="true" />
          </span>
          <span>
            <strong>
              Student<span>Food</span>
            </strong>
            <small>Món ngon, gần bạn hơn</small>
          </span>
        </Link>
        <nav aria-label="Điều hướng chính" className={styles.navigation}>
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
            Trang chủ
          </Link>
          <Link href="/#restaurants">Khám phá</Link>
          <Link href="/#reorder">Đơn hàng</Link>
        </nav>
        <div ref={actions} className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.iconButton} ${dropdownStyles.cartDisabled}`}
            aria-label="Giỏ hàng — chưa có trang giỏ hàng"
            title="Trang giỏ hàng sẽ được bổ sung sau"
            disabled
          >
            <ShoppingCart size={28} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Thông báo, ${unreadCount} chưa đọc`}
            aria-expanded={panel === "notifications"}
            aria-controls={
              panel === "notifications" ? "home-header-panel" : undefined
            }
            onClick={() => toggle("notifications")}
          >
            <Bell size={27} strokeWidth={1.6} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className={styles.notificationBadge}>{unreadCount}</span>
            )}
          </button>
          <button
            type="button"
            className={styles.accountButton}
            aria-expanded={panel === "account"}
            aria-controls={
              panel === "account" ? "home-header-panel" : undefined
            }
            onClick={() => toggle("account")}
          >
            <span className={styles.avatar}>{previewAccount.initial}</span>
            <span className={styles.accountName}>{previewAccount.name}</span>
            <ChevronDown size={21} aria-hidden="true" />
          </button>
          {panel === "notifications" && (
            <NotificationDropdown
              notifications={notifications}
              onReadAll={() =>
                setNotifications((items) =>
                  items.map((item) => ({ ...item, unread: false })),
                )
              }
              onRead={(id) =>
                setNotifications((items) =>
                  items.map((item) =>
                    item.id === id ? { ...item, unread: false } : item,
                  ),
                )
              }
            />
          )}
          {panel === "account" && (
            <AccountDropdown
              name={previewAccount.name}
              initial={previewAccount.initial}
              onNavigate={() => setPanel(null)}
            />
          )}
        </div>
      </div>
    </header>
  );
}
