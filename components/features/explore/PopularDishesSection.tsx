import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import type { PopularDishCard } from "@/lib/explore/popular-data";
import { formatMoney as formatPrice } from "@/lib/format";
import ExploreFoodPlaceholder from "./ExploreFoodPlaceholder";
import styles from "@/styles/explore.module.css";

export default function PopularDishesSection({
  dishes,
}: {
  dishes: PopularDishCard[];
}) {
  return (
    <section
      className={styles.popular}
      aria-labelledby="popular-dishes-title"
    >
      <div className={styles.sectionHeading}>
        <h2 id="popular-dishes-title">
          <span className={styles.sectionIcon}>
            <Flame size={24} aria-hidden="true" />
          </span>
          Món phổ biến hôm nay
        </h2>

        <Link href="/explore/popular" className={styles.seeAll}>
          Xem tất cả
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </div>

      <div
        className={styles.dishGrid}
        role="group"
        aria-label="Món phổ biến, cuộn ngang để xem thêm trên điện thoại"
        tabIndex={0}
      >
        {dishes.slice(0, 6).map((dish) => (
          <article
            key={`${dish.restaurantId}/${dish.id}`}
            className={styles.dishCard}
          >
            <ExploreFoodPlaceholder
              kind={dish.kind}
              imageUrl={dish.imageUrl}
            />

            <div className={styles.dishContent}>
              <h3>{dish.name}</h3>

              <p className={styles.price}>{formatPrice(dish.price)}</p>

              <p className={styles.restaurantName}>{dish.restaurantName}</p>

              <Link
                href={dish.href}
                className={styles.outlineButton}
                aria-label={`Xem món ${dish.name} tại ${dish.restaurantName}`}
              >
                Xem món
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
