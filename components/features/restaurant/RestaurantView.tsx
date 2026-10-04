"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Clock3,
  CookingPot,
  CreditCard,
  CupSoda,
  Drumstick,
  MapPin,
  Search,
  Settings,
  Soup,
  Utensils,
} from "lucide-react";
import {
  menuCategories,
  type MenuCategory,
  type RestaurantDetail,
} from "@/lib/restaurant/mock-data";
import styles from "@/styles/restaurant.module.css";
import { formatMoney as formatPrice } from "@/lib/format";
import { normalizeSearchText as normalize } from "@/lib/format";

const categoryIcons = {
  Cơm: CookingPot,
  "Món thêm": Soup,
  "Nước uống": CupSoda,
  "Ăn vặt": Drumstick,
  "Món chính": Utensils,
};

function FoodPlaceholder({ category = "Cơm" }: { category?: MenuCategory }) {
  const Icon = categoryIcons[category];

  return (
    <div className={styles.placeholder} aria-hidden="true">
      <span>
        <Icon size={38} strokeWidth={1.4} />
      </span>
    </div>
  );
}

export default function RestaurantView({
  restaurant,
}: {
  restaurant: RestaurantDetail;
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MenuCategory | null>(null);

  const availableCount = restaurant.menu.filter(
    (item) => item.available,
  ).length;

  const filteredMenu = restaurant.menu.filter((item) => {
    const matchesCategory = category === null || item.category === category;
    const matchesQuery = normalize(`${item.name} ${item.description}`).includes(
      normalize(query),
    );

    return matchesCategory && matchesQuery;
  });

  function resetFilters() {
    setInput("");
    setQuery("");
    setCategory(null);
  }

  return (
    <div className={styles.restaurantPage}>
      <div className={styles.topContent}>
        <Link href="/explore" className={styles.backLink}>
          <ArrowLeft size={21} aria-hidden="true" />
          Khám phá
        </Link>

        <section className={styles.summary} aria-labelledby="restaurant-title">
          <div className={styles.cover}>
            <FoodPlaceholder />
          </div>

          <div className={styles.summaryContent}>
            <div className={styles.titleRow}>
              <h1 id="restaurant-title">{restaurant.name}</h1>

              <span
                className={`${styles.status} ${
                  !restaurant.isOpen ? styles.closed : ""
                }`}
              >
                <span aria-hidden="true" />
                {restaurant.isOpen ? "Đang nhận đơn" : "Tạm đóng cửa"}
              </span>
            </div>

            <div className={styles.restaurantMeta}>
              <span>
                <MapPin size={23} aria-hidden="true" />
                {restaurant.location}
              </span>

              {restaurant.hours && (
                <span>
                  <Clock3 size={22} aria-hidden="true" />
                  {restaurant.hours}
                </span>
              )}

              <span>
                <Utensils size={22} aria-hidden="true" />
                {availableCount} món đang bán
              </span>
            </div>

            <p className={styles.description}>{restaurant.description}</p>

            {restaurant.payments.length > 0 && (
              <div className={styles.payments}>
                <span>Chấp nhận thanh toán:</span>

                {restaurant.payments.map((payment) => (
                  <span key={payment} className={styles.paymentChip}>
                    {payment === "Tiền mặt" ? (
                      <Banknote size={22} aria-hidden="true" />
                    ) : (
                      <CreditCard size={22} aria-hidden="true" />
                    )}
                    {payment}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <form
          role="search"
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(input);
          }}
        >
          <Search size={28} strokeWidth={1.7} aria-hidden="true" />

          <input
            type="search"
            aria-label={`Tìm món tại ${restaurant.name}`}
            placeholder={`Tìm món tại ${restaurant.name}...`}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />

          <button type="submit" className={styles.primaryButton}>
            Tìm kiếm
          </button>
        </form>

        <div
          className={styles.filters}
          role="group"
          aria-label="Danh mục món ăn"
        >
          <button
            type="button"
            aria-pressed={category === null}
            onClick={resetFilters}
          >
            Tất cả
          </button>

          {menuCategories.map((item) => {
            const Icon = categoryIcons[item];

            return (
              <button
                type="button"
                key={item}
                aria-pressed={category === item}
                onClick={() => setCategory(category === item ? null : item)}
              >
                <Icon size={23} aria-hidden="true" />
                {item}
              </button>
            );
          })}
        </div>
      </div>

      <section className={styles.menuSection} aria-labelledby="menu-title">
        <div className={styles.menuHeading}>
          <span className={styles.headingIcon}>
            <Utensils size={25} aria-hidden="true" />
          </span>
          <h2 id="menu-title">Menu của quán</h2>
          <span className={styles.menuCount}>
            {availableCount} món đang bán
          </span>
        </div>

        <p role="status" className={styles.srOnly}>
          Hiển thị {filteredMenu.length} món.
        </p>

        {filteredMenu.length > 0 ? (
          <div className={styles.menuGrid}>
            {filteredMenu.map((item) => (
              <article key={item.id} className={styles.menuCard}>
                <div className={styles.itemMedia}>
                  <FoodPlaceholder category={item.category} />

                  <span
                    className={`${styles.itemBadge} ${
                      !item.available ? styles.closed : ""
                    }`}
                  >
                    <span aria-hidden="true" />
                    {item.available ? "Đang bán" : "Hết món"}
                  </span>
                </div>

                <h3>{item.name}</h3>
                <p className={styles.itemDescription}>{item.description}</p>
                <p className={styles.price}>{formatPrice(item.price)}</p>

                <div className={styles.itemFooter}>
                  {item.hasOptions && (
                    <span className={styles.options}>
                      <Settings size={16} aria-hidden="true" />
                      Có tùy chọn thêm
                    </span>
                  )}

                  <Link
                    href={`/restaurants/${restaurant.slug}/menu/${item.id}`}
                    className={styles.primaryButton}
                    aria-label={`Xem món ${item.name}`}
                  >
                    Xem món
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>
              {restaurant.menu.length === 0
                ? "Quán này chưa có menu mẫu."
                : "Không tìm thấy món phù hợp."}
            </p>

            {restaurant.menu.length > 0 && (
              <button type="button" onClick={resetFilters}>
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
