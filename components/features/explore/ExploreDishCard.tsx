import Link from "next/link";
import { ArrowRight, Store, Utensils } from "lucide-react";
import type { PopularDishCard } from "@/lib/explore/popular-data";
import { formatMoney } from "@/lib/format";
import ExploreFoodPlaceholder from "./ExploreFoodPlaceholder";
import styles from "@/styles/explore.module.css";

export default function ExploreDishCard({
  dish,
}: {
  dish: PopularDishCard;
}) {
  const isOpen = dish.isOpen !== false;
  const displayCategory = dish.category || dish.categories[0] || "Khác";

  return (
    <article className={styles.restaurantCard}>
      <div className={styles.restaurantMedia}>
        <ExploreFoodPlaceholder kind={dish.kind} imageUrl={dish.imageUrl} />
      </div>

      <div className={styles.restaurantContent}>
        <div className={styles.restaurantTop}>
          <h3>{dish.name}</h3>

          <span
            className={`${styles.openBadge} ${
              !isOpen ? styles.closedBadge : ""
            }`}
          >
            <span className={styles.greenDot} aria-hidden="true" />
            {isOpen ? "Đang mở" : "Đã đóng"}
          </span>
        </div>

        <strong
          style={{
            color: "#ff4d1a",
            fontWeight: 800,
            fontSize: 15,
            margin: "2px 0",
          }}
        >
          {formatMoney(dish.price)}
        </strong>

        <p className={styles.location}>
          <Store size={15} aria-hidden="true" />
          {dish.restaurantName}
          {dish.location ? ` · ${dish.location}` : ""}
        </p>

        <div className={styles.meta}>
          <span title={displayCategory}>
            <Utensils size={15} aria-hidden="true" />
            <span>{displayCategory}</span>
          </span>
        </div>

        <Link
          href={dish.href}
          className={styles.primaryButton}
          aria-label={`Xem món ${dish.name}`}
        >
          Xem món
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
