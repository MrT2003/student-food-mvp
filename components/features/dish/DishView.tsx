"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CookingPot,
  CupSoda,
  IceCreamBowl,
  Info,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Snowflake,
  Store,
  Utensils,
} from "lucide-react";
import type { MenuItem } from "@/lib/restaurant/mock-data";
import type { DishOptions } from "@/lib/dish/options";
import styles from "@/styles/dish.module.css";

type Props = {
  restaurant: {
    slug: string;
    name: string;
    location: string;
    isOpen: boolean;
  };
  item: MenuItem;
  options: DishOptions;
};

function money(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

function FoodPlaceholder({ drink }: { drink: boolean }) {
  const Icon = drink ? CupSoda : CookingPot;

  return (
    <div className={styles.placeholder} aria-hidden="true">
      <Icon strokeWidth={1.3} />
    </div>
  );
}

export default function DishView({ restaurant, item, options }: Props) {
  const [toppingIds, setToppingIds] = useState<string[]>(
    options.defaultToppingIds,
  );
  const [sugarId, setSugarId] = useState(options.defaultSugarId);
  const [iceId, setIceId] = useState(options.defaultIceId);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");

  const isDrink = item.category === "Nước uống";

  const selectedToppings = options.toppings.filter((topping) =>
    toppingIds.includes(topping.id),
  );

  const selectedSugar = options.sugars.find(
    (choice) => choice.id === sugarId,
  );

  const selectedIce = options.iceLevels.find(
    (choice) => choice.id === iceId,
  );

  const toppingsPrice = selectedToppings.reduce(
    (total, topping) => total + topping.price,
    0,
  );

  const total = (item.price + toppingsPrice) * quantity;
  const canAdd = item.available && restaurant.isOpen;

  function toggleTopping(id: string) {
    setToppingIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    );
    setNotice("");
  }

  function handleAddToCart() {
    // Chưa ghi dữ liệu giỏ hàng hoặc gọi API.
    setNotice(
      "Bạn đang xem bản UI mẫu. Chức năng thêm vào giỏ hàng chưa được kết nối.",
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.leftColumn}>
        <Link
          href={`/restaurants/${restaurant.slug}`}
          className={styles.backLink}
        >
          <ArrowLeft size={21} aria-hidden="true" />
          Quay lại quán
        </Link>

        <div className={styles.mainCard}>
          <section className={styles.overview} aria-labelledby="dish-title">
            <div className={styles.heroMedia}>
              <FoodPlaceholder drink={isDrink} />
            </div>

            <div className={styles.overviewContent}>
              <div className={styles.titleRow}>
                <h1 id="dish-title">{item.name}</h1>

                <span
                  className={`${styles.badge} ${
                    !item.available ? styles.unavailable : ""
                  }`}
                >
                  <span aria-hidden="true" />
                  {item.available ? "Đang bán" : "Hết món"}
                </span>
              </div>

              <p className={styles.mainPrice}>{money(item.price)}</p>

              <div className={styles.metadata}>
                <Link href={`/restaurants/${restaurant.slug}`}>
                  <Store size={22} aria-hidden="true" />
                  {restaurant.name}
                </Link>

                <span>
                  <MapPin size={22} aria-hidden="true" />
                  {restaurant.location}
                </span>

                <span>
                  <Utensils size={22} aria-hidden="true" />
                  {isDrink ? "Đồ uống" : item.category}
                </span>
              </div>

              <p className={styles.description}>{item.description}</p>

              <div className={styles.info}>
                <Info size={23} aria-hidden="true" />
                <span>
                  {options.toppings.length > 0
                    ? "Hãy chọn topping, mức đường, mức đá và số lượng trước khi thêm vào giỏ hàng nhé!"
                    : "Hãy chọn số lượng trước khi thêm vào giỏ hàng nhé!"}
                </span>
              </div>
            </div>
          </section>

          {options.toppings.length > 0 && (
            <section className={styles.optionSection}>
              <div className={styles.optionHeading}>
                <IceCreamBowl size={27} aria-hidden="true" />
                <div>
                  <h2 id="topping-title">Topping thêm</h2>
                  <p>Chọn thêm topping yêu thích (có thể chọn nhiều)</p>
                </div>
              </div>

              <div
                className={styles.toppingGrid}
                role="group"
                aria-labelledby="topping-title"
              >
                {options.toppings.map((topping) => (
                  <label
                    key={topping.id}
                    className={styles.toppingOption}
                    data-selected={toppingIds.includes(topping.id)}
                  >
                    <input
                      type="checkbox"
                      checked={toppingIds.includes(topping.id)}
                      onChange={() => toggleTopping(topping.id)}
                    />

                    <span className={styles.toppingArt} aria-hidden="true">
                      <IceCreamBowl size={30} strokeWidth={1.4} />
                    </span>

                    <span className={styles.toppingCopy}>
                      <strong>{topping.name}</strong>
                      <span>+{money(topping.price)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {options.sugars.length > 0 && (
            <section className={styles.optionSection}>
              <div className={styles.optionHeading}>
                <CupSoda size={27} aria-hidden="true" />
                <div>
                  <h2 id="sugar-title">Mức đường</h2>
                  <p>Chọn độ ngọt phù hợp với khẩu vị của bạn</p>
                </div>
              </div>

              <div
                className={styles.sugarGrid}
                role="radiogroup"
                aria-labelledby="sugar-title"
              >
                {options.sugars.map((choice) => (
                  <label
                    key={choice.id}
                    className={styles.radioOption}
                    data-selected={sugarId === choice.id}
                  >
                    <input
                      type="radio"
                      name="dish-sugar"
                      value={choice.id}
                      checked={sugarId === choice.id}
                      onChange={() => setSugarId(choice.id)}
                    />
                    <span>
                      <strong>{choice.label}</strong>
                      <small>{choice.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          <section className={styles.optionSection}>
            {options.iceLevels.length > 0 && (
              <div className={styles.optionHeading}>
                <Snowflake size={27} aria-hidden="true" />
                <div>
                  <h2 id="ice-title">Mức đá</h2>
                  <p>Chọn lượng đá phù hợp</p>
                </div>
              </div>
            )}

            <div className={styles.iceQuantityRow}>
              {options.iceLevels.length > 0 && (
                <div
                  className={styles.iceGrid}
                  role="radiogroup"
                  aria-labelledby="ice-title"
                >
                  {options.iceLevels.map((choice) => (
                    <label
                      key={choice.id}
                      className={styles.radioOption}
                      data-selected={iceId === choice.id}
                    >
                      <input
                        type="radio"
                        name="dish-ice"
                        value={choice.id}
                        checked={iceId === choice.id}
                        onChange={() => setIceId(choice.id)}
                      />
                      <strong>{choice.label}</strong>
                    </label>
                  ))}
                </div>
              )}

              <div className={styles.quantity}>
                <span>Số lượng</span>

                <button
                  type="button"
                  aria-label="Giảm số lượng"
                  disabled={quantity <= 1}
                  onClick={() =>
                    setQuantity((current) => Math.max(1, current - 1))
                  }
                >
                  <Minus size={20} aria-hidden="true" />
                </button>

                <output aria-live="polite" aria-label="Số lượng món">
                  {quantity}
                </output>

                <button
                  type="button"
                  className={styles.plusButton}
                  aria-label="Tăng số lượng"
                  disabled={quantity >= 99}
                  onClick={() =>
                    setQuantity((current) => Math.min(99, current + 1))
                  }
                >
                  <Plus size={23} aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <aside className={styles.summary} aria-labelledby="selection-title">
        <div className={styles.summaryHeading}>
          <span>
            <ShoppingBag size={25} aria-hidden="true" />
          </span>
          <h2 id="selection-title">Tùy chọn đã chọn</h2>
        </div>

        <div className={styles.selectedDish}>
          <div className={styles.thumbnail}>
            <FoodPlaceholder drink={isDrink} />
          </div>

          <div className={styles.selectedDishCopy}>
            <h3>{item.name}</h3>
            <p>{restaurant.name}</p>
          </div>

          <strong>{money(item.price)}</strong>
        </div>

        {options.toppings.length > 0 && (
          <div className={styles.summarySection}>
            <h3>Topping thêm</h3>

            {selectedToppings.length > 0 ? (
              selectedToppings.map((topping) => (
                <div className={styles.summaryRow} key={topping.id}>
                  <span className={styles.selectedTopping}>
                    <Check size={15} aria-hidden="true" />
                    {topping.name}
                  </span>
                  <strong>+ {money(topping.price)}</strong>
                </div>
              ))
            ) : (
              <p className={styles.muted}>Không chọn topping</p>
            )}
          </div>
        )}

        {(selectedSugar || selectedIce) && (
          <div className={styles.summarySection}>
            {selectedSugar && (
              <div className={styles.summaryRow}>
                <strong>Mức đường</strong>
                <strong>
                  {selectedSugar.label} (
                  {selectedSugar.description.toLocaleLowerCase("vi-VN")})
                </strong>
              </div>
            )}

            {selectedIce && (
              <div className={styles.summaryRow}>
                <strong>Mức đá</strong>
                <strong>{selectedIce.label}</strong>
              </div>
            )}
          </div>
        )}

        <div className={styles.summarySection}>
          <div className={styles.summaryRow}>
            <span>Số lượng</span>
            <strong>{quantity}</strong>
          </div>
        </div>

        <div className={styles.totalRow}>
          <span>Tạm tính</span>
          <output aria-live="polite" aria-label="Tạm tính">
            {money(total)}
          </output>
        </div>

        <button
          type="button"
          className={styles.addButton}
          disabled={!canAdd}
          onClick={handleAddToCart}
        >
          {canAdd ? "Thêm vào giỏ hàng" : "Hiện không thể đặt món"}
          <ArrowRight size={21} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={styles.cartButton}
          onClick={() =>
            setNotice("Trang giỏ hàng chưa được bổ sung trong bản UI này.")
          }
        >
          <ShoppingCart size={25} aria-hidden="true" />
          Xem giỏ hàng
        </button>

        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
      </aside>
    </div>
  );
}