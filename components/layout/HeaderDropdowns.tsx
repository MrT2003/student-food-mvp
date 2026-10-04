import { useSignOut } from "@/lib/auth/useAuthFlow";
import styles from "@/styles/header-dropdowns.module.css";
import {
  CookingPot,
  CupSoda,
  LogOut,
  Soup,
  Store,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { HeaderNotification } from "./header-preview-data";

const icons = { rice: CookingPot, tea: CupSoda, noodles: Soup, spicy: Soup };

export function NotificationDropdown({
  notifications,
  onReadAll,
  onRead,
}: {
  notifications: HeaderNotification[];
  onReadAll: () => void;
  onRead: (id: string) => void;
}) {
  return (
    <section
      id="home-header-panel"
      className={`${styles.panel} ${styles.notifications}`}
      aria-labelledby="notification-title"
    >
      <div className={styles.heading}>
        <h2 id="notification-title">Thông báo</h2>
        <button
          type="button"
          onClick={onReadAll}
          disabled={!notifications.some((item) => item.unread)}
        >
          Đánh dấu tất cả đã đọc
        </button>
      </div>
      <ul className={styles.list}>
        {notifications.map((item) => {
          const Icon = icons[item.kind];
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`${styles.notification} ${item.unread ? styles.unread : ""}`}
                onClick={() => onRead(item.id)}
                aria-label={`${item.restaurant}. Đơn #${item.id} ${item.message} ${item.time}. ${item.unread ? "Chưa đọc" : "Đã đọc"}`}
              >
                <span className={styles.thumbnail} aria-hidden="true">
                  <Icon size={32} strokeWidth={1.4} />
                </span>
                <span className={styles.copy}>
                  <strong>{item.restaurant}</strong>
                  <span>
                    Đơn #{item.id} {item.message}
                  </span>
                  <span>{item.time}</span>
                </span>
                <span className={styles.dot} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}


interface AccountDropdownProps {
  name: string;
  initial: string;
  avatarUrl?: string | null;
  onNavigate: () => void;
}

export function AccountDropdown({
  name,
  initial,
  avatarUrl,
  onNavigate,
}: AccountDropdownProps) {
  const { logout, pending } = useSignOut();

  return (
    <section
      id="home-header-panel"
      className={`${styles.panel} ${styles.account}`}
      aria-label="Tài khoản"
    >
      <div className={styles.identity}>
        <span className={styles.avatar}>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={name}
              fill
              unoptimized // Dùng unoptimized cho ảnh Google/bên thứ 3 nếu chưa config domain trong next.config
              className={styles.avatarImage}
            />
          ) : (
            initial
          )}
        </span>
        <div>
          <strong>{name}</strong>
          <p>09•• ••• 567</p>
        </div>
      </div>

      <div className={styles.accountLinks}>
        <Link href="/account" onClick={onNavigate}>
          <UserRound aria-hidden="true" />
          Tài khoản của tôi
        </Link>
        <Link href="/seller/register" onClick={onNavigate}>
          <Store aria-hidden="true" />
          Đăng ký bán hàng
        </Link>
      </div>

      <button
        type="button"
        className={styles.logout}
        onClick={logout}
        disabled={pending}
      >
        <LogOut aria-hidden="true" />
        {pending ? "Đang xử lý..." : "Đăng xuất"}
      </button>
    </section>
  );
}
