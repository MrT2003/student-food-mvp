"use client";
import { ArrowRight, Clock3, CookingPot, CupSoda, RotateCcw } from "lucide-react";
import { useOrders } from "@/lib/orders/useOrders";
import { useReorder } from "@/lib/orders/useReorder";
import styles from "@/styles/home.module.css";
import Link from "next/link";

export default function ReorderSection() {
  const { historyOrders } = useOrders();
  const { reorder, addedIds, notice, setNotice } = useReorder();
  // Orders are newest first. Reorder the latest ended order for each restaurant.
  const groups = new Map<string, { order: (typeof historyOrders)[number]; count: number }>();
  for (const order of historyOrders) {
    const group = groups.get(order.restaurantId);
    if (group) group.count++;
    else groups.set(order.restaurantId, { order, count: 1 });
  }
  return (
    <section
      id="reorder"
      className={styles.reorderSection}
      aria-labelledby="reorder-title"
    >
      <div className={styles.sectionHeading}>
        <h2 id="reorder-title">
          <span className={styles.sectionIcon}>
            <Clock3 size={25} aria-hidden="true" />
          </span>
          Đặt lại nhanh
        </h2>
        <Link className={styles.seeAll} href="/orders/history">
          Xem tất cả
          <ArrowRight size={21} aria-hidden="true" />
        </Link>
      </div>
      {notice && <div role="status">
        <p>{notice}</p>
        <Link href="/cart">Xem giỏ hàng</Link>{" · "}
        <button type="button" onClick={() => setNotice("")}>Đóng</button>
      </div>}
      {groups.size === 0 && <p>Chưa có đơn hàng trong lịch sử để đặt lại. Đơn đang xử lý sẽ xuất hiện tại đây sau khi kết thúc.</p>}
      <div id="reorder-list" className={styles.restaurantGrid}>
        {[...groups.values()].slice(0, 3).map(({ order, count }) => (
          <article key={order.restaurantId} className={styles.reorderCard}>
            <div className={`${styles.foodPlaceholder} ${styles.smallPlaceholder}`} aria-hidden="true">
              <span className={styles.placeholderCircle} />
              {order.kind === "drink" ? <CupSoda strokeWidth={1.25} /> : <CookingPot strokeWidth={1.25} />}
            </div>
            <div className={styles.reorderContent}>
              <h3>{order.restaurantName}</h3>
              <p>{count} đơn trong lịch sử</p>
              <p
                className={styles.reorderCategories}
              >
                Đơn gần nhất: {order.quantity} món · {order.placedAt}
              </p>
              <button
                type="button"
                className={styles.outlineButton}
                disabled={addedIds.has(order.id)}
                onClick={() => reorder(order.id)}
              >
                <RotateCcw size={17} aria-hidden="true" />
                {addedIds.has(order.id) ? "Đã thêm vào giỏ" : "Đặt lại"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
