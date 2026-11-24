"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  ChevronUp,
  FileText,
  Info,
  Landmark,
  MapPin,
  Pencil,
  ReceiptText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/store/useCartStore";
import styles from "@/styles/order-confirm.module.css";
import { useRouter } from "next/navigation";
import { formatMoney as money } from "@/lib/format";
import { useCartSummary } from "@/lib/cart/useCartSummary";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import {
  getCartItemTotal,
  getCartItemUnitPrice,
} from "@/lib/cart/calculations";

type RestaurantBankRow = {
  restaurant_id: string;
  bank_name: string;
  account_no: string;
  account_name: string;
  is_default: boolean;
};

function FoodPlaceholder({ kind }: { kind: "food" | "drink" }) {
  return <FoodThumbnail kind={kind} className={styles.placeholder} />;
}

export default function OrderConfirmView() {
  const location = useCartStore((state) => state.location);
  const address = useCartStore((state) => state.address);
  const setLocation = useCartStore((state) => state.setLocation);
  const setAddress = useCartStore((state) => state.setAddress);
  const preferences = useCartStore((state) => state.preferences);
  const setPreference = useCartStore((state) => state.setPreference);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMobileAddress, setEditingMobileAddress] = useState(false);
  const [collapsedRestaurants, setCollapsedRestaurants] = useState<
    Record<string, boolean>
  >({});
  const [restaurantBanks, setRestaurantBanks] = useState<
    Record<string, RestaurantBankRow>
  >({});
  const addressInput = useRef<HTMLInputElement>(null);

  const router = useRouter();

  const submitting = useRef(false);
  const checkoutDatabaseCart = useCartStore(
    (state) => state.checkoutDatabaseCart,
  );

  const {
    items,
    groups,
    quantity: totalQuantity,
    subtotal: total,
  } = useCartSummary();
  const deliveryFee = 0;

  useEffect(() => {
    const restaurantIds = groups.map((g) => g.restaurant.id);
    if (restaurantIds.length === 0) return;

    let cancelled = false;
    const supabase = createClient();
    void supabase
      .from("restaurant_banks")
      .select("restaurant_id, bank_name, account_no, account_name, is_default")
      .in("restaurant_id", restaurantIds)
      .then(({ data }) => {
        if (cancelled || !Array.isArray(data)) return;
        const map: Record<string, RestaurantBankRow> = {};
        for (const row of data as RestaurantBankRow[]) {
          const existing = map[row.restaurant_id];
          if (!existing || row.is_default) {
            map[row.restaurant_id] = row;
          }
        }
        setRestaurantBanks(map);
      });

    return () => {
      cancelled = true;
    };
  }, [groups]);

  function toggleRestaurantCollapse(restaurantId: string) {
    setCollapsedRestaurants((prev) => ({
      ...prev,
      [restaurantId]: !prev[restaurantId],
    }));
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) return;

    setError("");
    setMessage("");

    if (!address.trim()) {
      setEditingMobileAddress(true);
      setError("Vui lòng nhập chi tiết địa chỉ nhận hàng.");
      addressInput.current?.focus();
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    try {
      const result = await checkoutDatabaseCart();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.replace("/cart/success");
    } catch {
      setError("Có lỗi xảy ra khi đặt hàng. Vui lòng thử lại.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
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
          <Link
            href="/cart"
            className={styles.mobileBackButton}
            aria-label="Quay lại giỏ hàng"
          >
            <ArrowLeft size={26} strokeWidth={2.3} aria-hidden="true" />
          </Link>
          <div className={styles.pageHeadingText}>
            <h1>Xác nhận đơn hàng</h1>
            <p>Vui lòng kiểm tra kỹ thông tin trước khi đặt hàng.</p>
          </div>
        </div>

        <ol className={styles.mobileSteps} aria-label="Các bước đặt hàng">
          <li className={styles.completedStep}>
            <span>
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <Link href="/cart">Giỏ hàng</Link>
          </li>

          <li className={styles.activeStep} aria-current="step">
            <span>2</span>
            <p>Xác nhận đơn hàng</p>
          </li>
        </ol>

        <section
          className={styles.mobileAddressCard}
          aria-label="Địa chỉ nhận hàng"
        >
          <div className={styles.mobileAddressTop}>
            <div className={styles.mobileAddressTitle}>
              <span className={styles.orangeIcon}>
                <MapPin size={16} aria-hidden="true" />
              </span>
              <h2>Địa chỉ nhận hàng</h2>
            </div>

            <button
              type="button"
              className={styles.changeAddressBtn}
              onClick={() => setEditingMobileAddress((prev) => !prev)}
            >
              <Pencil size={14} strokeWidth={2.2} aria-hidden="true" />
              {editingMobileAddress ? "Xong" : "Thay đổi"}
            </button>
          </div>

          {!editingMobileAddress ? (
            <div className={styles.mobileAddressSummary}>
              <div className={styles.mobileAddressCol}>
                <span>Khu KTX</span>
                <strong>{location}</strong>
              </div>
              <div className={styles.mobileAddressCol}>
                <span>Chi tiết địa chỉ</span>
                <strong>{address.trim() || "Chưa nhập địa chỉ"}</strong>
              </div>
            </div>
          ) : (
            <div className={styles.mobileAddressForm}>
              <div className={styles.field}>
                <label htmlFor="mobile-confirm-location">Khu KTX</label>
                <select
                  id="mobile-confirm-location"
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
                <label htmlFor="mobile-confirm-address">Chi tiết địa chỉ</label>
                <input
                  id="mobile-confirm-address"
                  value={address}
                  maxLength={250}
                  placeholder="Ví dụ: Tòa A1, Phòng 201"
                  onChange={(event) => {
                    setAddress(event.target.value);
                    setError("");
                    setMessage("");
                  }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </section>

        {groups.length === 0 ? (
          <div className={styles.empty}>
            <h2>Giỏ hàng đang trống</h2>
            <p>Vui lòng chọn món trước khi xác nhận đơn hàng.</p>
            <Link href="/cart">Quay lại giỏ hàng</Link>
          </div>
        ) : (
          <>
            <div className={styles.banner}>
              <span className={styles.bannerIconBadge}>
                <Info size={16} aria-hidden="true" />
              </span>
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
              const isCollapsed = Boolean(collapsedRestaurants[restaurant.id]);
              const bankInfo = restaurantBanks[restaurant.id];

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

                    <button
                      type="button"
                      className={`${styles.collapseButton} ${
                        isCollapsed ? styles.collapseButtonClosed : ""
                      }`}
                      aria-label={
                        isCollapsed
                          ? "Mở rộng chi tiết quán"
                          : "Thu gọn chi tiết quán"
                      }
                      onClick={() => toggleRestaurantCollapse(restaurant.id)}
                    >
                      <ChevronUp
                        size={19}
                        strokeWidth={2.2}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  {!isCollapsed && (
                    <>
                      <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                          <caption className={styles.srOnly}>
                            Các món của {restaurant.name}. Đơn giá đã gồm tùy
                            chọn.
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
                                            • {extra.name} (+{money(extra.price)}
                                            )
                                          </p>
                                        ))}
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
                                    event.target.value === "bank"
                                      ? "bank"
                                      : "cash",
                                });
                                setMessage("");
                              }}
                            >
                              <option value="bank">
                                Chuyển khoản ngân hàng
                              </option>
                              <option value="cash">
                                Tiền mặt (Thanh toán khi nhận món)
                              </option>
                            </select>
                            {preference.payment === "bank" && (
                              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#19325c" }}>
                                {bankInfo ? (
                                  <>
                                    <strong>{bankInfo.bank_name}</strong> · STK:{" "}
                                    <strong>{bankInfo.account_no}</strong> · Chủ TK:{" "}
                                    <strong>{bankInfo.account_name}</strong>
                                  </>
                                ) : (
                                  "Thông tin chuyển khoản của quán sẽ hiển thị sau khi tạo đơn."
                                )}
                              </p>
                            )}
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
                    </>
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>

      <aside className={styles.sidebar}>
        <section className={`${styles.sideCard} ${styles.desktopAddressCard}`}>
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

        <section className={`${styles.sideCard} ${styles.desktopSummaryCard}`}>
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
            disabled={items.length === 0 || isSubmitting}
          >
            {isSubmitting ? "Đang xử lý…" : "Xác nhận đặt hàng"}
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

        <section className={styles.mobileBottomBar}>
          <div className={styles.summaryHandle} aria-hidden="true" />

          <div className={styles.mobileSummaryGrid}>
            <div className={styles.mobileSummaryDetails}>
              <div className={styles.mobileSummaryHeading}>
                <span className={styles.orangeIcon}>
                  <ReceiptText size={16} aria-hidden="true" />
                </span>
                <h2>Tổng quan đơn hàng</h2>
              </div>

              <div className={styles.mobileSummaryRow}>
                <span>Tạm tính ({totalQuantity} món)</span>
                <strong>{money(total)}</strong>
              </div>

              <div className={styles.mobileSummaryRow}>
                <span>Phí giao hàng</span>
                <span className={styles.freeDelivery}>{money(deliveryFee)}</span>
              </div>

              <div className={styles.mobileTotalRow}>
                <strong>Tổng cộng</strong>
                <output aria-live="polite" aria-label="Tổng tiền đơn hàng">
                  {money(total)}
                </output>
              </div>
            </div>

            <div className={styles.mobileSummaryAction}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={items.length === 0 || isSubmitting}
              >
                {isSubmitting ? "Đang xử lý…" : "Xác nhận đặt hàng"}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </aside>
    </form>
  );
}
