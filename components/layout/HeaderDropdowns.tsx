import {
  CookingPot,
  CupSoda,
  LogOut,
  Soup,
  Store,
  UserRound,
} from "lucide-react";
import type { HeaderNotification } from "./header-preview-data";
import styles from "./header-dropdowns.module.css";
import Link from "next/link";

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

export function AccountDropdown({
  name,
  initial,
  onNavigate,
}: {
  name: string;
  initial: string;
  onNavigate: () => void;
}) {
  return (
    <section
      id="home-header-panel"
      className={`${styles.panel} ${styles.account}`}
      aria-label="Tài khoản"
    >
      <div className={styles.identity}>
        <span className={styles.avatar}>{initial}</span>
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
        <button
          type="button"
          disabled
          title="Chưa kết nối trang đăng ký bán hàng"
        >
          <Store aria-hidden="true" />
          Đăng ký bán hàng
        </button>
      </div>
      <button
        type="button"
        className={styles.logout}
        disabled
        title="Giao diện mẫu, chưa kết nối phiên đăng nhập"
      >
        <LogOut aria-hidden="true" />
        Đăng xuất
      </button>
    </section>
  );
}
