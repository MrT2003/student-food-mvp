"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchInbox, markNotificationRead, notificationHref, useNotificationInbox } from "@/store/useNotificationInbox";
import styles from "@/styles/header-dropdowns.module.css";

export default function NotificationInboxDropdown() {
  const inbox = useNotificationInbox();
  const router = useRouter();
  useEffect(() => {
    useNotificationInbox.setState({ open: true });
    void fetchInbox(true);
    return () => { useNotificationInbox.setState({ open: false }); };
  }, []);
  return <section id="home-header-panel" className={`${styles.panel} ${styles.notifications}`} aria-label="Thông báo">
    <div className={styles.heading}><h2>Thông báo</h2>
      <button disabled={!inbox.unreadCount} onClick={() => void markNotificationRead("all")}>Đánh dấu tất cả đã đọc</button></div>
    {inbox.error && <p role="alert">{inbox.error} <button onClick={() => { useNotificationInbox.setState({ listAt: 0 }); void fetchInbox(true); }}>Thử lại</button></p>}
    {!inbox.loading && !inbox.error && !inbox.items.length && <p className="p-4">Bạn chưa có thông báo.</p>}
    <ul className={styles.list}>
      {inbox.items.map(item => <li key={item.id}>
        <button className={`${styles.notification} ${!item.is_read ? styles.unread : ""}`} style={{ opacity: item.is_read ? 0.65 : 1 }}
          onClick={() => { void markNotificationRead(item.id); router.push(notificationHref(item)); }}>
          <span className={styles.copy}><strong>{item.title || "Thông báo"}</strong><span>{item.content}</span>
            <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</time>
            <span className="sr-only">{item.is_read ? "Đã đọc" : "Chưa đọc"}</span></span>
          {!item.is_read && <span className={styles.dot} aria-hidden="true" />}
        </button>
      </li>)}
    </ul>
    {inbox.loading && <p role="status" className="p-3">Đang tải thông báo…</p>}
    {inbox.nextCursor && <button className="p-3 underline" disabled={inbox.loading} onClick={() => void fetchInbox(true, true)}>Xem thêm</button>}
  </section>;
}
