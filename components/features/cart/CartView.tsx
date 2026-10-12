"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Info,
  MapPin,
  Minus,
  Plus,
  ReceiptText,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import styles from "@/styles/cart.module.css";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { formatMoney as money } from "@/lib/format";
import { useCartSummary } from "@/lib/cart/useCartSummary";
import FoodThumbnail from "@/components/ui/FoodThumbnail";

function FoodPlaceholder({ kind }: { kind: "food" | "drink" }) {
  return <FoodThumbnail kind={kind} className={styles.placeholder} />;
}

export default function CartView() {
  const router = useRouter();

  const updateQuantity = useCartStore((state) => state.updateCartItemQuantity);
  const removeCartItem = useCartStore((state) => state.removeCartItem);
  const location = useCartStore((state) => state.location);
  const setLocation = useCartStore((state) => state.setLocation);
  const address = useCartStore((state) => state.address);
  const setAddress = useCartStore((state) => state.setAddress);
  const [message, setMessage] = useState("");
  const [addressError, setAddressError] = useState("");
  const { items, groups, quantity, subtotal, unknownRestaurantIds } = useCartSummary();
  const deliveryFee = 0;
  const total = subtotal + deliveryFee;

  function changeQuantity(id: string, change: number) {
    const item = items.find((row) => row.id === id);
    if (!item) return;
    const result = updateQuantity(id, Math.min(99, Math.max(1, item.quantity + change)));
    setMessage(result.ok ? "" : result.message);
  }

  function removeItem(id: string) {
    const result = removeCartItem(id);
    setMessage(result.ok ? "Đã xóa món khỏi giỏ hàng." : result.message);
  }

  function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setAddressError("");

    if (items.length === 0) return;

    if (unknownRestaurantIds.length > 0) {
      setMessage(
        "Có món chưa xác định được cửa hàng. Vui lòng kiểm tra lại giỏ hàng.",
      );
      return;
    }

    if (!address.trim()) {
      setAddressError("Vui lòng nhập chi tiết địa chỉ nhận hàng.");
      return;
    }

    setAddress(address.trim());
    router.push("/cart/confirm");
  }
  return (
    <div className={styles.page}>
      <aside className={styles.stepsColumn} aria-label="Các bước đặt hàng">
        <Link
          href="/explore"
          className={styles.backButton}
          aria-label="Quay lại Khám phá"
        >
          <ArrowLeft size={38} aria-hidden="true" />
        </Link>

        <ol className={styles.steps}>
          {["Giỏ hàng", "Xác nhận"].map((step, index) => (
            <li
              key={step}
              aria-current={index === 0 ? "step" : undefined}
              className={index === 0 ? styles.activeStep : undefined}
            >
              <span>{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </aside>

      <div className={styles.cartColumn}>
        <div className={styles.pageHeading}>
          <h1>Giỏ hàng</h1>
          <p>Kiểm tra các món ăn trong giỏ hàng của bạn</p>
        </div>

        {items.length === 0 ? (
          <section className={styles.empty}>
            <ShoppingCart size={48} aria-hidden="true" />
            <h2>Giỏ hàng của bạn đang trống</h2>
            <p>Khám phá các quán ăn để chọn món bạn yêu thích.</p>
            <Link href="/explore" className={styles.primaryButton}>
              Khám phá món ngon
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
          </section>
        ) : (
          groups.map((group) => {
            const {
              restaurant,
              items: restaurantItems,
              quantity: restaurantQuantity,
              subtotal: restaurantTotal,
            } = group;
            return (
              <section
                className={styles.restaurantCard}
                key={restaurant.id}
                aria-labelledby={`cart-${restaurant.id}`}
              >
                <div className={styles.restaurantHeader}>
                  <div className={styles.restaurantImage}>
                    <FoodPlaceholder kind={restaurant.kind} />
                  </div>

                  <div>
                    <div className={styles.restaurantTitle}>
                      <h2 id={`cart-${restaurant.id}`}>{restaurant.name}</h2>
                      <span className={styles.openBadge}>
                        {restaurant.isOpen ? "Đang nhận đơn" : "Tạm đóng cửa"}
                      </span>
                    </div>

                    <p className={styles.location}>
                      <MapPin size={21} aria-hidden="true" />
                      {restaurant.location}
                    </p>
                  </div>
                </div>

                <ul className={styles.itemList}>
                  {restaurantItems.map((item) => (
                    <li className={styles.itemRow} key={item.id}>
                      <div className={styles.itemImage}>
                        <FoodPlaceholder kind={item.kind} />
                      </div>

                      <div className={styles.itemContent}>
                        <h3>{item.name}</h3>
                        <p className={styles.itemPrice}>
                          {money(item.basePrice)}
                        </p>

                        {item.extras.map((extra) => (
                          <p className={styles.itemNote} key={extra.id}>
                            + {extra.name} (+{money(extra.price)})
                          </p>
                        ))}

                      </div>

                      <div className={styles.itemActions}>
                        <div className={styles.quantity}>
                          <button
                            type="button"
                            aria-label={`Giảm số lượng ${item.name}`}
                            disabled={item.quantity <= 1}
                            onClick={() => changeQuantity(item.id, -1)}
                          >
                            <Minus size={18} aria-hidden="true" />
                          </button>

                          <output aria-label={`Số lượng ${item.name}`}>
                            {item.quantity}
                          </output>

                          <button
                            type="button"
                            aria-label={`Tăng số lượng ${item.name}`}
                            disabled={item.quantity >= 99}
                            onClick={() => changeQuantity(item.id, 1)}
                          >
                            <Plus size={18} aria-hidden="true" />
                          </button>
                        </div>

                        <button
                          type="button"
                          className={styles.removeButton}
                          aria-label={`Xóa ${item.name} khỏi giỏ hàng`}
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 size={22} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className={styles.restaurantSubtotal}>
                  <span>Tạm tính ({restaurantQuantity} món)</span>
                  <strong>{money(restaurantTotal)}</strong>
                </div>
              </section>
            );
          })
        )}
      </div>

      <form className={styles.sidebar} onSubmit={handleCheckout}>
        <section className={styles.sideCard}>
          <div className={styles.cardHeading}>
            <span className={styles.orangeIcon}>
              <MapPin size={25} aria-hidden="true" />
            </span>
            <h2>Địa chỉ nhận hàng</h2>
          </div>

          <div className={styles.field}>
            <label htmlFor="cart-location">Khu KTX</label>
            <select
              id="cart-location"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setMessage("");
              }}
            >
              <option value="KTX A">KTX A</option>
              <option value="KTX B">KTX B</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="cart-address">Chi tiết địa chỉ</label>
            <input
              id="cart-address"
              name="address"
              autoComplete="street-address"
              value={address}
              maxLength={250}
              required
              aria-invalid={Boolean(addressError)}
              aria-describedby={
                addressError ? "cart-address-error" : "cart-address-hint"
              }
              onChange={(event) => {
                setAddress(event.target.value);
                setAddressError("");
                setMessage("");
              }}
            />
          </div>

          <p className={styles.addressHint} id="cart-address-hint">
            <Info size={20} aria-hidden="true" />
            <span>Địa chỉ này sẽ giúp shipper dễ dàng tìm đến bạn hơn.</span>
          </p>

          {addressError && (
            <p id="cart-address-error" className={styles.error} role="alert">
              {addressError}
            </p>
          )}
        </section>

        <section className={styles.sideCard}>
          <div className={styles.cardHeading}>
            <span className={styles.orangeIcon}>
              <ReceiptText size={24} aria-hidden="true" />
            </span>
            <h2>Tổng quan đơn hàng</h2>
          </div>

          <div className={styles.summaryRow}>
            <span>Tạm tính ({quantity} món)</span>
            <strong>{money(subtotal)}</strong>
          </div>

          <div className={styles.summaryRow}>
            <span>Phí giao hàng</span>
            <strong>{money(deliveryFee)}</strong>
          </div>

          <div className={styles.totalRow}>
            <strong>Tổng cộng</strong>
            <output aria-live="polite" aria-label="Tổng tiền giỏ hàng">
              {money(total)}
            </output>
          </div>

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={items.length === 0}
          >
            Xác nhận đơn hàng
            <ArrowRight size={23} aria-hidden="true" />
          </button>

          {message && (
            <p className={styles.message} role="status">
              {message}
            </p>
          )}
        </section>

        <section className={styles.sideCard}>
          <div className={styles.cardHeading}>
            <span className={styles.blueIcon}>
              <Info size={26} aria-hidden="true" />
            </span>
            <h2>Lưu ý</h2>
          </div>

          <ul className={styles.notes}>
            <li>
              Bạn có thể chỉnh sửa số lượng hoặc tùy chọn món trước khi đặt
              hàng.
            </li>
            <li>Địa chỉ KTX giúp shipper giao hàng nhanh hơn.</li>
            <li>
              Sau khi đặt hàng, bạn có thể theo dõi trạng thái đơn hàng trong
              mục Đơn hàng của tôi.
            </li>
          </ul>
        </section>
      </form>
    </div>
  );
}
