"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Store,
  Utensils,
} from "lucide-react";

import type {
  MenuItemDetail,
  MenuOptionGroupDetail,
  RestaurantPublic,
} from "@/types/restaurant.types";

import {
  clearSelectedOptionGroup,
  normalizeSelectedOptions,
  resolveSelectedOptions,
  toggleSelectedOption,
} from "@/lib/cart/options";
import {
  getDefaultSelectedOptions,
  getDishDescription,
  getDishInfoBannerText,
  getDisplayCategory,
  getOptionGroupKind,
  getOptionGroupSubtitle,
  isDrinkDish,
  parseSugarOptionLabel,
  previewDrinkItem,
  previewDrinkRestaurant,
  previewFoodItem,
  previewFoodRestaurant,
  resolveDishOptionGroups,
} from "@/lib/dish/options";
import type { SelectedOption } from "@/types/cart.types";
import {
  CartUtilities,
  type SelectedGroup,
} from "@/utilities/cart_order.utility";

import { useCartStore } from "@/store/useCartStore";
import { useFlyToCart } from "@/lib/cart/useFlyToCart";
import { formatMoney as money } from "@/lib/format";
import { DishHeroMedia } from "@/components/features/dish/DishMedia";
import styles from "@/styles/dish.module.css";

export type DishViewProps = {
  restaurant?: RestaurantPublic;
  item?: MenuItemDetail;
  mode?: "drink" | "food";
  defaultSelectedOptionIds?: readonly string[];
  defaultQuantity?: number;
};

export default function DishView({
  restaurant,
  item,
  mode = "drink",
  defaultSelectedOptionIds,
  defaultQuantity = 1,
}: DishViewProps) {
  const resolvedRestaurant =
    restaurant ??
    (mode === "food" ? previewFoodRestaurant : previewDrinkRestaurant);
  const resolvedItem =
    item ?? (mode === "food" ? previewFoodItem : previewDrinkItem);

  // Different dishes must not inherit the previous dish's option IDs or quantity.
  return (
    <DishSelection
      key={resolvedItem.id}
      restaurant={resolvedRestaurant}
      item={resolvedItem}
      defaultSelectedOptionIds={defaultSelectedOptionIds}
      defaultQuantity={defaultQuantity}
    />
  );
}

function DishSelection({
  restaurant,
  item,
  defaultSelectedOptionIds,
  defaultQuantity = 1,
}: {
  restaurant: RestaurantPublic;
  item: MenuItemDetail;
  defaultSelectedOptionIds?: readonly string[];
  defaultQuantity?: number;
}) {
  const addToDatabaseCart = useCartStore((state) => state.addToDatabaseCart);
  const addCatalogItem = useCartStore((state) => state.addCatalogItem);

  const { sourceRef, flyToCart } = useFlyToCart();

  const groups = resolveDishOptionGroups(item);
  const effectiveItem: MenuItemDetail = {
    ...item,
    option_groups: groups,
  };

  const [selected, setSelected] = useState<SelectedOption[]>(() =>
    getDefaultSelectedOptions(item, groups, defaultSelectedOptionIds),
  );
  const [quantity, setQuantity] = useState(() =>
    Math.min(99, Math.max(1, defaultQuantity)),
  );
  const [notice, setNotice] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const selectedIds = new Set(selected.map((option) => option.option_id));
  const selectedOptions = groups.flatMap((group) =>
    group.options
      .filter((option) => selectedIds.has(option.id))
      .map((option) => ({
        ...option,
        groupName: group.name,
        groupKind: getOptionGroupKind(group),
      })),
  );

  // Hiển thị giá tạm tính trong lúc người dùng đang chọn.
  const additionalPrice = selectedOptions.reduce(
    (sum, option) => sum + option.additional_price,
    0,
  );

  const total = (item.price + additionalPrice) * quantity;
  const isDrink = isDrinkDish(item);
  const displayCategory = getDisplayCategory(item);
  const description = getDishDescription(item);
  const infoBannerText = getDishInfoBannerText(item, groups);

  const isRestaurantOpen =
    restaurant.status === "active" && restaurant.operating_status === "open";

  const canAdd = isRestaurantOpen && item.is_active && item.is_available;

  const dishBadgeLabel = !isRestaurantOpen
    ? "Quán tạm đóng cửa"
    : item.is_available && item.is_active
      ? "Đang bán"
      : "Hết món";

  const restaurantHref = `/restaurants/${encodeURIComponent(restaurant.slug)}`;

  function toggleOption(group: MenuOptionGroupDetail, optionId: string) {
    if (!canAdd) return;
    setSelected((current) => toggleSelectedOption(current, group, optionId));
    setNotice("");
  }

  function clearGroup(group: MenuOptionGroupDetail) {
    if (!canAdd) return;
    setSelected((current) => clearSelectedOptionGroup(current, group));
    setNotice("");
  }

  async function handleAddToCart() {
    if (!canAdd || isAdding) {
      if (!canAdd) {
        setNotice("Món đã hết hoặc quán đang tạm đóng cửa.");
      }
      return;
    }

    try {
      // Allowlist payload fields: names/prices are for display only.
      const selected_options = normalizeSelectedOptions(
        selected.map(({ option_id }) => ({ option_id })),
      );
      // Báo rõ nhóm nào chưa chọn hoặc lựa chọn không hợp lệ.
      resolveSelectedOptions(effectiveItem, selected_options);

      const dbGroupIds = new Set(
        item.option_groups
          .filter((g) => g.is_active)
          .map((g) => g.id),
      );

      const selectedGroups: SelectedGroup[] = groups
        .filter((group) => dbGroupIds.has(group.id))
        .map((group) => ({
          group_id: group.id,
          group_name: group.name,
          options: group.options
            .filter((option) => selectedIds.has(option.id))
            .map((option) => ({
              id: option.id,
              name: option.option_name,
              additional_price: option.additional_price,
            })),
        }))
        .filter((group) => group.options.length > 0);

      const optionHash = CartUtilities.generateHash(selectedGroups) || "NONE";

      setIsAdding(true);
      const result = await addToDatabaseCart({
        menuItemId: item.id,
        restaurantId: restaurant.id,
        optionHash,
        quantity,
        selectedOptions: selectedGroups,
      });

      if (!result.ok) {
        const dbOptionIds = new Set(
          item.option_groups
            .filter((g) => g.is_active)
            .flatMap((g) => g.options.filter((o) => o.is_active).map((o) => o.id)),
        );
        const fallbackOptions = selected_options.filter((opt) =>
          dbOptionIds.has(opt.option_id),
        );
        const localResult = addCatalogItem({
          restaurant_id: restaurant.id,
          menu_item_id: item.id,
          quantity,
          selected_options: fallbackOptions,
        });

        if (!localResult.ok) {
          setNotice(result.message);
          return;
        }
      }

      flyToCart();
      setNotice(`Đã thêm ${quantity} × ${item.name} vào giỏ hàng.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể thêm món vào giỏ hàng.",
      );
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className={styles.page} data-dish-kind={isDrink ? "drink" : "food"}>
      <div className={styles.leftColumn}>
        <Link href={restaurantHref} className={styles.backLink}>
          <ArrowLeft size={20} aria-hidden="true" />
          Quay lại quán
        </Link>

        <div className={styles.mainCard}>
          <section className={styles.overview} aria-labelledby="dish-title">
            <div className={styles.heroMedia}>
              <DishHeroMedia
                drink={isDrink}
                imageUrl={item.image_url}
                alt={item.name}
                slug={item.slug}
              />
            </div>

            <div className={styles.overviewContent}>
              <div className={styles.titleRow}>
                <h1 id="dish-title">{item.name}</h1>

                <span
                  className={`${styles.badge} ${
                    !canAdd ? styles.unavailable : ""
                  }`}
                >
                  <span aria-hidden="true" />
                  {dishBadgeLabel}
                </span>
              </div>

              <p className={styles.mainPrice}>{money(item.price)}</p>

              <div className={styles.metadata}>
                <Link href={restaurantHref}>
                  <Store size={15} aria-hidden="true" />
                  {restaurant.name}
                </Link>
                <span>
                  <MapPin size={15} aria-hidden="true" />
                  {restaurant.location}
                </span>
                <span>
                  <Utensils size={15} aria-hidden="true" />
                  {displayCategory}
                </span>
              </div>

              <p className={styles.description}>{description}</p>
            </div>
          </section>

          <div className={styles.infoCard}>
            <div
              className={`${styles.info} ${
                !canAdd ? styles.infoClosed : ""
              }`}
            >
              <span className={styles.infoBadge} aria-hidden="true">
                <Info size={16} strokeWidth={2.4} />
              </span>
              <span>
                {!isRestaurantOpen
                  ? "Quán hiện đang tạm đóng cửa nên chưa thể chọn tùy chọn hoặc đặt món lúc này."
                  : !item.is_available || !item.is_active
                    ? "Món ăn này hiện đã hết hàng, bạn vui lòng chọn món khác của quán nhé."
                    : infoBannerText}
              </span>
            </div>
          </div>

          {groups.map((group) => {
            const groupKind = getOptionGroupKind(group);

            return (
              <section
                key={group.id}
                className={`${styles.optionSection} ${
                  !canAdd ? styles.optionSectionDisabled : ""
                }`}
                data-group-kind={groupKind}
                aria-labelledby={`group-${group.id}`}
              >
                <div className={styles.optionHeading}>
                  <div>
                    <h2 id={`group-${group.id}`}>{group.name}</h2>
                    <p>{getOptionGroupSubtitle(group)}</p>
                  </div>
                </div>

                {(groupKind === "topping" || groupKind === "food-extra") && (
                  <div
                    className={styles.toppingGrid}
                    role={group.is_multiple ? "group" : "radiogroup"}
                    aria-labelledby={`group-${group.id}`}
                  >
                    {group.options.map((option) => {
                      const isSelected = canAdd && selectedIds.has(option.id);
                      return (
                        <label
                          key={option.id}
                          className={styles.toppingOption}
                          data-selected={isSelected}
                          data-disabled={!canAdd}
                        >
                          <input
                            type={group.is_multiple ? "checkbox" : "radio"}
                            name={`option-group-${group.id}`}
                            value={option.id}
                            checked={isSelected}
                            disabled={!canAdd}
                            onChange={() => toggleOption(group, option.id)}
                            className={styles.srOnlyInput}
                          />

                          <span
                            className={styles.checkIndicator}
                            data-checked={isSelected}
                            aria-hidden="true"
                          >
                            {isSelected ? (
                              <Check size={14} strokeWidth={3} />
                            ) : null}
                          </span>

                          <span className={styles.toppingCopy}>
                            <strong>{option.option_name}</strong>
                            <span className={styles.toppingPrice}>
                              {option.additional_price > 0
                                ? `+${money(option.additional_price)}`
                                : "Miễn phí"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {groupKind === "sugar" && (
                  <div
                    className={styles.sugarGrid}
                    role="radiogroup"
                    aria-labelledby={`group-${group.id}`}
                  >
                    {group.options.map((option) => {
                      const isSelected = canAdd && selectedIds.has(option.id);
                      const { percentLabel, tasteLabel } =
                        parseSugarOptionLabel(option.option_name);

                      return (
                        <label
                          key={option.id}
                          className={styles.sugarOption}
                          data-selected={isSelected}
                          data-disabled={!canAdd}
                        >
                          <input
                            type="radio"
                            name={`option-group-${group.id}`}
                            value={option.id}
                            checked={isSelected}
                            disabled={!canAdd}
                            onChange={() => toggleOption(group, option.id)}
                            className={styles.srOnlyInput}
                          />

                          <span
                            className={styles.radioIndicator}
                            data-checked={isSelected}
                            aria-hidden="true"
                          />

                          <span className={styles.sugarTop}>
                            <strong>{percentLabel}</strong>
                            <small className={styles.sugarSub}>
                              {tasteLabel}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {(groupKind === "ice" || groupKind === "other") && (
                  <div
                    className={styles.iceGrid}
                    role={group.is_multiple ? "group" : "radiogroup"}
                    aria-labelledby={`group-${group.id}`}
                  >
                    {group.options.map((option) => {
                      const isSelected = canAdd && selectedIds.has(option.id);
                      return (
                        <label
                          key={option.id}
                          className={styles.iceOption}
                          data-selected={isSelected}
                          data-disabled={!canAdd}
                        >
                          <input
                            type={group.is_multiple ? "checkbox" : "radio"}
                            name={`option-group-${group.id}`}
                            value={option.id}
                            checked={isSelected}
                            disabled={!canAdd}
                            onChange={() => toggleOption(group, option.id)}
                            className={styles.srOnlyInput}
                          />

                          <span
                            className={styles.radioIndicator}
                            data-checked={isSelected}
                            aria-hidden="true"
                          />

                          <span className={styles.iceCopy}>
                            <strong>{option.option_name}</strong>
                            {option.additional_price > 0 && (
                              <small>+{money(option.additional_price)}</small>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {!group.is_required && !group.is_multiple && (
                  <button
                    type="button"
                    className={styles.clearButton}
                    disabled={!canAdd}
                    onClick={() => clearGroup(group)}
                  >
                    Bỏ lựa chọn
                  </button>
                )}
              </section>
            );
          })}

          <section
            className={`${styles.optionSection} ${styles.quantitySection} ${
              !canAdd ? styles.optionSectionDisabled : ""
            }`}
            aria-label="Số lượng món"
          >
            <div className={styles.quantityRow}>
              <div className={styles.quantityHeading}>
                <span className={styles.quantityLabel}>Số lượng</span>
              </div>

              <div className={styles.quantity}>
                <button
                  type="button"
                  className={styles.minusButton}
                  aria-label="Giảm số lượng"
                  disabled={!canAdd || quantity <= 1}
                  onClick={() =>
                    setQuantity((current) => Math.max(1, current - 1))
                  }
                >
                  <Minus size={18} strokeWidth={2.4} aria-hidden="true" />
                </button>

                <output aria-live="polite" aria-label="Số lượng món">
                  {quantity}
                </output>

                <button
                  type="button"
                  className={styles.plusButton}
                  aria-label="Tăng số lượng"
                  disabled={!canAdd || quantity >= 99}
                  onClick={() =>
                    setQuantity((current) => Math.min(99, current + 1))
                  }
                >
                  <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className={styles.bottomBar}>
          <div className={styles.bottomTotal}>
            <span className={styles.bottomTotalLabel}>Tạm tính</span>
            <output
              className={styles.bottomTotalValue}
              aria-live="polite"
              aria-label="Tạm tính"
            >
              {money(total)}
            </output>
          </div>

          <div className={styles.bottomDivider} aria-hidden="true" />

          <button
            type="button"
            className={styles.bottomAddButton}
            disabled={!canAdd || isAdding}
            onClick={handleAddToCart}
          >
            <ShoppingCart size={20} aria-hidden="true" />
            <span>
              {canAdd ? "Thêm vào giỏ hàng" : "Hiện không thể đặt món"}
            </span>
            <ArrowRight size={19} aria-hidden="true" />
          </button>
        </div>

        {notice && (
          <p className={styles.mobileNotice} role="status">
            {notice}
          </p>
        )}
      </div>

      <aside className={styles.summary} aria-labelledby="selection-title">
        <div className={styles.summaryHeading}>
          <span>
            <ShoppingBag size={24} aria-hidden="true" />
          </span>
          <h2 id="selection-title">Tùy chọn đã chọn</h2>
        </div>

        <div className={styles.selectedDish}>
          <div ref={sourceRef} className={styles.thumbnail}>
            <DishHeroMedia
              drink={isDrink}
              imageUrl={item.image_url}
              alt={item.name}
              slug={item.slug}
            />
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
          disabled={!canAdd || isAdding}
          onClick={handleAddToCart}
        >
          <ShoppingCart size={20} aria-hidden="true" />
          {canAdd ? "Thêm vào giỏ hàng" : "Hiện không thể đặt món"}
          <ArrowRight size={20} aria-hidden="true" />
        </button>

        <Link href="/cart" className={styles.cartButton}>
          <ShoppingCart size={22} aria-hidden="true" />
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
