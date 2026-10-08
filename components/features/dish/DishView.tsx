"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CookingPot,
  CupSoda,
  Info,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
} from "lucide-react";

import type {
  MenuItemDetail,
  MenuOptionGroupDetail,
  RestaurantPublic,
} from "@/types/restaurant.types";

import {
  clearSelectedOptionGroup,
  resolveSelectedOptions,
  toggleSelectedOption,
} from "@/lib/cart/options";
import type { SelectedOption } from "@/types/cart.types";

import { useCartStore } from "@/store/useCartStore";
import { useFlyToCart } from "@/lib/cart/useFlyToCart";
import { formatMoney as money } from "@/lib/format";
import styles from "@/styles/dish.module.css";

type Props = {
  restaurant: RestaurantPublic;
  item: MenuItemDetail;
};

function FoodPlaceholder({ drink }: { drink: boolean }) {
  const Icon = drink ? CupSoda : CookingPot;

  return (
    <div className={styles.placeholder} aria-hidden="true">
      <Icon strokeWidth={1.3} />
    </div>
  );
}

export default function DishView({ restaurant, item }: Props) {
  // Different dishes must not inherit the previous dish's option IDs or quantity.
  return <DishSelection key={item.id} restaurant={restaurant} item={item} />;
}

function DishSelection({ restaurant, item }: Props) {
  const addCatalogItem = useCartStore((state) => state.addCatalogItem);

  const { sourceRef, flyToCart } = useFlyToCart();

  const [selected, setSelected] = useState<SelectedOption[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");

  const groups = item.option_groups
    .filter((group) => group.is_active)
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => option.is_active),
    }));

  const selectedIds = new Set(selected.map((option) => option.option_id));
  const selectedOptions = groups.flatMap((group) =>
    group.options
      .filter((option) => selectedIds.has(option.id))
      .map((option) => ({
        ...option,
        groupName: group.name,
      })),
  );

  // Hiển thị giá tạm tính trong lúc người dùng đang chọn.
  // Khi thêm vào giỏ, store kiểm tra lại toàn bộ lựa chọn.
  const additionalPrice = selectedOptions.reduce(
    (sum, option) => sum + option.additional_price,
    0,
  );

  const total = (item.price + additionalPrice) * quantity;
  const isDrink = item.category === "Nước uống";

  const canAdd =
    restaurant.status === "active" &&
    restaurant.operating_status === "open" &&
    item.is_active &&
    item.is_available;

  const restaurantHref = `/restaurants/${encodeURIComponent(restaurant.slug)}`;

  function toggleOption(group: MenuOptionGroupDetail, optionId: string) {
    setSelected((current) => toggleSelectedOption(current, group, optionId));

    setNotice("");
  }

  function clearGroup(group: MenuOptionGroupDetail) {
    setSelected((current) => clearSelectedOptionGroup(current, group));

    setNotice("");
  }

  function handleAddToCart() {
    if (!canAdd) {
      setNotice("Món đã hết hoặc quán đang tạm đóng cửa.");
      return;
    }

    try {
      // Báo rõ nhóm nào chưa chọn hoặc lựa chọn không hợp lệ.
      resolveSelectedOptions(item, selected);

      const result = addCatalogItem({
        restaurant_id: restaurant.id,
        menu_item_id: item.id,
        quantity,
        selected_options: selected,
      });

      if (!result.ok) {
        setNotice(result.message);
        return;
      }

      flyToCart();
      setNotice(`Đã thêm ${quantity} × ${item.name} vào giỏ hàng.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể thêm món vào giỏ hàng.",
      );
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.leftColumn}>
        <Link href={restaurantHref} className={styles.backLink}>
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
                    !item.is_available ? styles.unavailable : ""
                  }`}
                >
                  <span aria-hidden="true" />
                  {item.is_available ? "Đang bán" : "Hết món"}
                </span>
              </div>

              <p className={styles.mainPrice}>{money(item.price)}</p>

              <div className={styles.metadata}>
                <Link href={restaurantHref}>{restaurant.name}</Link>
                <span>{restaurant.location}</span>
                <span>{item.category}</span>
              </div>

              <p className={styles.description}>{item.description}</p>

              <div className={styles.info}>
                <Info size={23} aria-hidden="true" />
                <span>Chọn tùy chọn và số lượng trước khi thêm vào giỏ.</span>
              </div>
            </div>
          </section>

          {groups.map((group) => (
            <section
              key={group.id}
              className={styles.optionSection}
              aria-labelledby={`group-${group.id}`}
            >
              <div className={styles.optionHeading}>
                <div>
                  <h2 id={`group-${group.id}`}>{group.name}</h2>
                  <p>
                    {group.is_required ? "Bắt buộc" : "Không bắt buộc"}
                    {" · "}
                    {group.is_multiple ? "Có thể chọn nhiều" : "Chọn một"}
                  </p>
                </div>
              </div>

              <div
                className={styles.toppingGrid}
                role={group.is_multiple ? "group" : "radiogroup"}
                aria-labelledby={`group-${group.id}`}
              >
                {group.options.map((option) => (
                  <label
                    key={option.id}
                    className={styles.radioOption}
                    data-selected={selectedIds.has(option.id)}
                  >
                    <input
                      type={group.is_multiple ? "checkbox" : "radio"}
                      name={`option-group-${group.id}`}
                      value={option.id}
                      checked={selectedIds.has(option.id)}
                      onChange={() => toggleOption(group, option.id)}
                    />

                    <span>
                      <strong>{option.option_name}</strong>
                      <small>
                        {option.additional_price > 0
                          ? `+${money(option.additional_price)}`
                          : "Không phụ thu"}
                      </small>
                    </span>
                  </label>
                ))}
              </div>

              {!group.is_required && !group.is_multiple && (
                <button type="button" onClick={() => clearGroup(group)}>
                  Bỏ lựa chọn
                </button>
              )}
            </section>
          ))}

          <section className={styles.optionSection}>
            <div className={styles.iceQuantityRow}>
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
          <div ref={sourceRef} className={styles.thumbnail}>
            <FoodPlaceholder drink={isDrink} />
          </div>

          <div className={styles.selectedDishCopy}>
            <h3>{item.name}</h3>
            <p>{restaurant.name}</p>
          </div>

          <strong>{money(item.price)}</strong>
        </div>

        {selectedOptions.length > 0 && (
          <div className={styles.summarySection}>
            {selectedOptions.map((option) => (
              <div className={styles.summaryRow} key={option.id}>
                <span>
                  {option.groupName}: {option.option_name}
                </span>
                <strong>
                  {option.additional_price > 0
                    ? `+${money(option.additional_price)}`
                    : "0đ"}
                </strong>
              </div>
            ))}
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
          <output aria-live="polite">{money(total)}</output>
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

        <Link href="/cart" className={styles.cartButton}>
          <ShoppingCart size={25} aria-hidden="true" />
          Xem giỏ hàng
        </Link>

        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
      </aside>
    </div>
  );
}
