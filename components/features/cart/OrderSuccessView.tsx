"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Check,
  ClipboardList,
  CreditCard,
  House,
  MapPin,
  ReceiptText,
  Store,
  Truck,
  Utensils,
} from "lucide-react";
import { useCheckout } from "@/lib/orders/useCheckout";
import { orderStatusLabels } from "@/lib/orders/order-detail";
import styles from "@/styles/order-success.module.css";
import { formatMoney as money } from "@/lib/format";
import FoodThumbnail from "@/components/ui/FoodThumbnail";

function FoodPlaceholder({ kind }: { kind: "food" | "drink" }) {
  return <FoodThumbnail kind={kind} className={styles.placeholder} />;
}

export default function OrderSuccessView() {
  const checkout = useCheckout();

  if (!checkout || checkout.orders.length === 0) {
    return (
      <section className={styles.empty}>
        <ReceiptText size={48} aria-hidden="true" />
        <h1>Chưa có thông tin đơn hàng</h1>
        <p>
          Chưa có phiên đặt hàng gần nhất. Vui lòng quay lại giỏ hàng để tiếp tục.
        </p>
        <Link href="/cart" className={styles.primaryButton}>
          Về giỏ hàng
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const orderCount = checkout.orders.length;

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="success-title">
        <div className={styles.successArt} aria-hidden="true">
          <span className={styles.confettiLeft} />
          <span className={styles.checkCircle}>
            <Check size={74} strokeWidth={3} />
          </span>
          <span className={styles.confettiRight} />
        </div>

        <h1 id="success-title">Đặt hàng thành công!</h1>
        <p>Cảm ơn bạn đã đặt món. Các cửa hàng sẽ sớm xác nhận đơn hàng.</p>

        <div className={styles.successBanner}>
          <Truck size={42} strokeWidth={1.7} aria-hidden="true" />
          <div>
            <strong>
              Bạn đã tạo {orderCount} đơn hàng từ {orderCount} cửa hàng
              {orderCount > 1 ? " khác nhau" : ""}.
            </strong>
            <p>Mỗi cửa hàng sẽ xử lý đơn riêng.</p>
          </div>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.orderList} aria-label="Các đơn hàng đã tạo">
          {checkout.orders.map((order) => {
            const PaymentIcon =
              order.paymentMethod === "bank_transfer" ? CreditCard : Banknote;

            const paymentLabel = order.payment;

            return (
              <article className={styles.orderCard} key={order.id}>
                <div className={styles.orderMain}>
                  <div className={styles.restaurantImage}>
                    <FoodPlaceholder kind={order.kind} />
                  </div>

                  <div className={styles.orderInfo}>
                    <div className={styles.orderHeading}>
                      <h2>{order.restaurantName}</h2>
                      <span className={styles.status}>{orderStatusLabels[order.status]}</span>
                    </div>

                    <p className={styles.orderCode}>
                      Đơn hàng #{order.orderCode}
                    </p>

                    <div className={styles.orderMeta}>
                      <span>
                        <Utensils size={25} aria-hidden="true" />
                        {order.quantity} món
                      </span>

                      <span>
                        <PaymentIcon size={25} aria-hidden="true" />
                        {paymentLabel}
                      </span>
                    </div>
                  </div>

                  <div className={styles.total}>
                    <span>Tổng tiền</span>
                    <strong>{money(order.total)}</strong>
                  </div>
                </div>

                <details className={styles.details}>
                  <summary>
                    Xem chi tiết
                    <ArrowRight size={19} aria-hidden="true" />
                  </summary>

                  <div className={styles.detailsContent}>
                    <ul>
                      {order.items.map((item) => (
                        <li key={item.id}>
                          <div>
                            <strong>
                              {item.name} × {item.quantity}
                            </strong>

                            {item.optionSnapshots.map((option) => (
                              <p key={option.option_id}>
                                + {option.group_name}: {option.option_name} (+{money(option.additional_price)})
                              </p>
                            ))}

                          </div>

                          <strong>{money(item.unitPrice * item.quantity)}</strong>
                        </li>
                      ))}
                    </ul>

                    {order.note && (
                      <p className={styles.orderNote}>
                        <strong>Ghi chú:</strong> {order.note}
                      </p>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </section>

        <aside className={styles.sidebar}>
          <section className={styles.addressCard}>
            <span className={styles.locationIcon}>
              <MapPin size={37} aria-hidden="true" />
            </span>

            <div>
              <h2>Địa chỉ nhận hàng</h2>
              <p>{checkout.location}</p>
              <p>{checkout.address}</p>
            </div>
          </section>

          <section className={styles.timelineCard}>
            <h2>Điều gì xảy ra tiếp theo?</h2>

            <ol className={styles.timeline}>
              <li className={styles.currentStep} aria-current="step">
                <span className={styles.stepIcon}>
                  <ClipboardList size={23} aria-hidden="true" />
                </span>
                <div>
                  <h3>Đã đặt hàng</h3>
                  <p>Cảm ơn bạn đã đặt món!</p>
                </div>
              </li>

              <li>
                <span className={styles.stepIcon}>
                  <Store size={23} aria-hidden="true" />
                </span>
                <div>
                  <h3>Cửa hàng xác nhận</h3>
                  <p>Cửa hàng sẽ sớm xác nhận đơn hàng.</p>
                </div>
              </li>

              <li>
                <span className={styles.stepIcon}>
                  <Check size={26} aria-hidden="true" />
                </span>
                <div>
                  <h3>Hoàn thành</h3>
                  <p>Chúc bạn ngon miệng!</p>
                </div>
              </li>
            </ol>
          </section>
        </aside>
      </div>

      <div className={styles.actions}>
        <Link href="/" className={styles.primaryButton}>
          <House size={27} aria-hidden="true" />
          Về trang chủ
        </Link>

        <Link href="/orders" className={styles.secondaryButton}>
          <ReceiptText size={27} aria-hidden="true" />
          Đơn hàng của tôi
        </Link>
      </div>

      <p className={styles.demoNote}>
        Bản xem trước giao diện: chưa gửi đơn đến cửa hàng hoặc thực hiện thanh
        toán.
      </p>
    </div>
  );
}
