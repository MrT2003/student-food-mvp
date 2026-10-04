"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  FileText,
  Info,
  Landmark,
  MapPin,
  Pencil,
  ReceiptText,
} from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import styles from "@/styles/order-confirm.module.css";
import { useRouter } from "next/navigation";
import { useOrderPreviewStore } from "@/store/useOrderPreviewStore";
import { formatMoney as money } from "@/lib/format";
import { useCartSummary } from "@/lib/cart/useCartSummary";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import {
  getCartItemTotal,
  getCartItemUnitPrice,
} from "@/lib/cart/calculations";

function FoodPlaceholder({ kind }: { kind: "food" | "drink" }) {
  return <FoodThumbnail kind={kind} className={styles.placeholder} />;
}

export default function OrderConfirmView() {
  const items = useCartStore((state) => state.items);
  const location = useCartStore((state) => state.location);
  const address = useCartStore((state) => state.address);
  const setLocation = useCartStore((state) => state.setLocation);
  const setAddress = useCartStore((state) => state.setAddress);
  const preferences = useCartStore((state) => state.preferences);
  const setPreference = useCartStore((state) => state.setPreference);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const addressInput = useRef<HTMLInputElement>(null);

  const router = useRouter();

  const saveCheckoutPreview = useOrderPreviewStore(
    (state) => state.saveCheckoutPreview,
  );

  const submitting = useRef(false);

  const {
    groups,
    quantity: totalQuantity,
    subtotal: total,
    unknownRestaurantIds,
  } = useCartSummary();

  function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Tránh tạo hai kết quả mẫu nếu bấm liên tiếp.
    if (submitting.current) return;

    setError("");
    setMessage("");

    if (items.length === 0) {
      setError("Giỏ hàng đang trống.");
      return;
    }

    if (!address.trim()) {
      setError("Vui lòng nhập chi tiết địa chỉ nhận hàng.");
      addressInput.current?.focus();
      return;
    }

    if (groups.length === 0 || unknownRestaurantIds.length > 0) {
      setError(
        "Có món chưa xác định được cửa hàng. Vui lòng kiểm tra giỏ hàng.",
      );
      return;
    }

    if (groups.some((group) => !group.restaurant.isOpen)) {
      setError(
        "Có cửa hàng đang tạm đóng cửa. Vui lòng kiểm tra lại giỏ hàng.",
      );
      return;
    }

    submitting.current = true;

    saveCheckoutPreview({
      location,
      address,
      orders: groups.map((group) => ({
        restaurantId: group.restaurant.id,
        restaurantName: group.restaurant.name,
        restaurantLocation: group.restaurant.location,
        kind: group.restaurant.kind,
        quantity: group.quantity,
        total: group.subtotal,
        payment: preferences[group.restaurant.id]?.payment ?? "cash",
        note: preferences[group.restaurant.id]?.note ?? "",
        items: group.items,
      })),
    });
    router.replace("/cart/success");
  }

  return (
    <form className={styles.page} onSubmit={handleConfirm}>
      <aside className={styles.stepsColumn} aria-label="Các bước đặt hàng">
        <Link
          href="/cart"
          className={styles.backIcon}
          aria-label="Quay lại giỏ hàng"
        >
          <ArrowLeft size={36} aria-hidden="true" />
        </Link>

        <ol className={styles.steps}>
          <li className={styles.completedStep}>
            <span>
              <Check size={25} aria-hidden="true" />
            </span>
            <Link href="/cart">Giỏ hàng</Link>
          </li>

          <li className={styles.activeStep} aria-current="step">
            <span>2</span>
            <p>Xác nhận</p>
          </li>
        </ol>
      </aside>

      <div className={styles.mainColumn}>
        <div className={styles.pageHeading}>
          <h1>Xác nhận đơn hàng</h1>
          <p>Vui lòng kiểm tra kỹ thông tin trước khi đặt hàng.</p>
        </div>

        {groups.length === 0 ? (
          <div className={styles.empty}>
            <h2>Giỏ hàng đang trống</h2>
            <p>Vui lòng chọn món trước khi xác nhận đơn hàng.</p>
            <Link href="/cart">Quay lại giỏ hàng</Link>
          </div>
        ) : (
          <>
            <div className={styles.banner}>
              <Info size={23} aria-hidden="true" />
              <p>
                Bạn đang đặt món từ <strong>{groups.length} cửa hàng</strong>.
                {groups.length > 1 &&
                  " Mỗi cửa hàng sẽ được tạo thành một đơn hàng riêng."}
              </p>
            </div>

            {groups.map((group) => {
              const { restaurant } = group;
              const preference = preferences[restaurant.id] ?? {
                payment: "cash",
                note: "",
              };

              return (
                <section
                  key={restaurant.id}
                  className={styles.restaurantCard}
                  aria-labelledby={`confirm-${restaurant.id}`}
                >
                  <div className={styles.restaurantHeader}>
                    <div className={styles.restaurantImage}>
                      <FoodPlaceholder kind={restaurant.kind} />
                    </div>

                    <div className={styles.restaurantIdentity}>
                      <div className={styles.restaurantTitle}>
                        <h2 id={`confirm-${restaurant.id}`}>
                          {restaurant.name}
                        </h2>
                        <span className={styles.badge}>
                          {restaurant.isOpen ? "Đang nhận đơn" : "Tạm đóng cửa"}
                        </span>
                      </div>
                      <p>
                        <MapPin size={19} aria-hidden="true" />
                        {restaurant.location}
                      </p>
                    </div>

                    <div className={styles.restaurantTotal}>
                      <span>Tạm tính</span>
                      <strong>{money(group.subtotal)}</strong>
                    </div>
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <caption className={styles.srOnly}>
                        Các món của {restaurant.name}. Đơn giá đã gồm tùy chọn.
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Món ăn</th>
                          <th scope="col">Đơn giá</th>
                          <th scope="col">Số lượng</th>
                          <th scope="col">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => {
                          const unitPrice = getCartItemUnitPrice(item);

                          return (
                            <tr key={item.id}>
                              <td>
                                <div className={styles.dish}>
                                  <div className={styles.dishImage}>
                                    <FoodPlaceholder kind={item.kind} />
                                  </div>

                                  <div>
                                    <h3>{item.name}</h3>
                                    {item.extras.map((extra) => (
                                      <p key={extra.id}>
                                        • {extra.name} (+{money(extra.price)})
                                      </p>
                                    ))}
                                    {item.note && <p>• {item.note}</p>}
                                  </div>
                                </div>
                              </td>
                              <td>{money(unitPrice)}</td>
                              <td>{item.quantity}</td>
                              <td>{money(getCartItemTotal(item))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.restaurantFooter}>
                    <div className={styles.footerField}>
                      {preference.payment === "bank" ? (
                        <Landmark
                          className={styles.bankIcon}
                          size={29}
                          aria-hidden="true"
                        />
                      ) : (
                        <Banknote
                          className={styles.cashIcon}
                          size={29}
                          aria-hidden="true"
                        />
                      )}

                      <div>
                        <label htmlFor={`payment-${restaurant.id}`}>
                          Phương thức thanh toán
                        </label>
                        <select
                          id={`payment-${restaurant.id}`}
                          value={preference.payment}
                          onChange={(event) => {
                            setPreference(restaurant.id, {
                              payment:
                                event.target.value === "bank" ? "bank" : "cash",
                            });
                            setMessage("");
                          }}
                        >
                          <option value="bank">Chuyển khoản ngân hàng</option>
                          <option value="cash">
                            Tiền mặt (Thanh toán khi nhận món)
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className={styles.footerField}>
                      <FileText size={28} aria-hidden="true" />

                      <div>
                        <label htmlFor={`note-${restaurant.id}`}>
                          Ghi chú cho đơn hàng
                        </label>
                        <textarea
                          id={`note-${restaurant.id}`}
                          rows={2}
                          maxLength={300}
                          value={preference.note}
                          placeholder="Nhập ghi chú cho quán..."
                          onChange={(event) => {
                            setPreference(restaurant.id, {
                              note: event.target.value,
                            });
                            setMessage("");
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>

      <aside className={styles.sidebar}>
        <section className={styles.sideCard}>
          <div className={styles.sideHeading}>
            <span className={styles.orangeIcon}>
              <MapPin size={23} aria-hidden="true" />
            </span>
            <h2>Địa chỉ nhận hàng</h2>

            <button
              type="button"
              className={styles.editButton}
              onClick={() => addressInput.current?.focus()}
            >
              <Pencil size={18} aria-hidden="true" />
              Thay đổi
            </button>
          </div>

          <div className={styles.field}>
            <label htmlFor="confirm-location">Khu KTX</label>
            <select
              id="confirm-location"
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
            <label htmlFor="confirm-address">Chi tiết địa chỉ</label>
            <input
              ref={addressInput}
              id="confirm-address"
              autoComplete="street-address"
              maxLength={250}
              required
              value={address}
              aria-describedby="confirm-address-hint"
              onChange={(event) => {
                setAddress(event.target.value);
                setError("");
                setMessage("");
              }}
            />
          </div>

          <p id="confirm-address-hint" className={styles.addressHint}>
            Vui lòng nhập rõ cổng, tòa, phòng để shipper dễ dàng tìm thấy bạn.
          </p>
        </section>

        <section className={styles.sideCard}>
          <div className={styles.sideHeading}>
            <span className={styles.orangeIcon}>
              <ReceiptText size={22} aria-hidden="true" />
            </span>
            <div>
              <h2>Tóm tắt đơn hàng</h2>
              <p>
                {groups.length} cửa hàng · {totalQuantity} món ăn
              </p>
            </div>
          </div>

          {groups.map((group) => (
            <div className={styles.summaryShop} key={group.restaurant.id}>
              <div className={styles.summaryImage}>
                <FoodPlaceholder kind={group.restaurant.kind} />
              </div>

              <div>
                <h3>{group.restaurant.name}</h3>
                <p>{group.quantity} món</p>
              </div>

              <strong>{money(group.subtotal)}</strong>
            </div>
          ))}

          <div className={styles.totalRow}>
            <strong>Tổng cộng</strong>
            <output aria-live="polite" aria-label="Tổng tiền đơn hàng">
              {money(total)}
            </output>
          </div>

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={items.length === 0}
          >
            Xác nhận đặt hàng
            <ArrowRight size={23} aria-hidden="true" />
          </button>

          <Link href="/cart" className={styles.backButton}>
            <ArrowLeft size={22} aria-hidden="true" />
            Quay lại
          </Link>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className={styles.message} role="status">
              {message}
            </p>
          )}
        </section>
      </aside>
    </form>
  );
}
