"use client";

import { ArrowRight, Clock3, CookingPot, CupSoda, RotateCcw } from "lucide-react";
import { previewRestaurants, type PreviewRestaurant } from "@/lib/home/mock-data";
import { useOrders } from "@/lib/orders/useOrders";
import { useReorder } from "@/lib/orders/useReorder";
import FoodPlaceholder from "./FoodPlaceholder";
import styles from "@/styles/home.module.css";
import Link from "next/link";

type Props = {
  restaurants?: PreviewRestaurant[];
  onSelect?: (restaurant: PreviewRestaurant) => void;
};

export default function ReorderSection({
  restaurants = previewRestaurants,
  onSelect,
}: Props) {
  const { historyOrders } = useOrders();
  const { reorder, addedIds, notice, setNotice } = useReorder();
  // Orders are newest first. Reorder the latest ended order for each restaurant.
  const groups = new Map<
    string,
    { order: (typeof historyOrders)[number]; count: number }
  >();
  for (const order of historyOrders) {
    const group = groups.get(order.restaurantId);
    if (group) group.count++;
    else groups.set(order.restaurantId, { order, count: 1 });
  }
  const hasHistory = groups.size > 0;

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
      {notice && (
        <div role="status" className={styles.reorderNotice}>
          <p>{notice}</p>
          <Link href="/cart">Xem giỏ hàng</Link>
          {" · "}
          <button type="button" onClick={() => setNotice("")}>
            Đóng
          </button>
        </div>
      )}
      <div
        id="reorder-list"
        className={styles.restaurantGrid}
        data-compact="true"
      >
        {hasHistory
          ? [...groups.values()].slice(0, 6).map(({ order, count }) => {
              const matchedRestaurant = restaurants.find(
                (entry) => entry.id === order.restaurantId,
              );
              return (
                <article key={order.restaurantId} className={styles.reorderCard}>
                  {matchedRestaurant ? (
                    <FoodPlaceholder restaurant={matchedRestaurant} small />
                  ) : (
                    <div
                      className={`${styles.foodPlaceholder} ${styles.smallPlaceholder}`}
                      aria-hidden="true"
                    >
                      <span className={styles.placeholderCircle} />
                      {order.kind === "drink" ? (
                        <CupSoda strokeWidth={1.25} />
                      ) : (
                        <CookingPot strokeWidth={1.25} />
                      )}
                    </div>
                  )}
                  <div className={styles.reorderContent}>
                    <h3>{order.restaurantName}</h3>
                    <p>Đã đặt {count} lần</p>
                    <p
                      className={styles.reorderCategories}
                      title={
                        matchedRestaurant
                          ? matchedRestaurant.categories.join(", ")
                          : `Đơn gần nhất: ${order.quantity} món · ${order.placedAt}`
                      }
                    >
                      {matchedRestaurant
                        ? matchedRestaurant.categories.join(", ")
                        : `Đơn gần nhất: ${order.quantity} món · ${order.placedAt}`}
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
              );
            })
          : restaurants.map((restaurant) => (
              <article key={restaurant.id} className={styles.reorderCard}>
                <FoodPlaceholder restaurant={restaurant} small />
                <div className={styles.reorderContent}>
                  <h3>{restaurant.name}</h3>
                  <p>Đã đặt {restaurant.orderCount} lần</p>
                  <p
                    className={styles.reorderCategories}
                    title={restaurant.categories.join(", ")}
                  >
                    {restaurant.categories.join(", ")}
                  </p>
                  <button
                    type="button"
                    className={styles.outlineButton}
                    onClick={() => onSelect?.(restaurant)}
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                    Đặt lại
                  </button>
                </div>
              </article>
            ))}
      </div>
    </section>
  );
}
