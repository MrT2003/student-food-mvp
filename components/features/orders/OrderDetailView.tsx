"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import TransferContent from "@/components/ui/TransferContent";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ClipboardList,
  Clock3,
  CreditCard,
  Info,
  MapPin,
  Milk,
  RotateCw,
  Utensils,
} from "lucide-react";
import {
  formatOrderMoney,
  type OrderDetailStatus,
} from "@/lib/orders/order-detail";
import styles from "@/styles/order-detail.module.css";
import { useOrderDetail } from "@/lib/orders/useOrderDetail";
import { useStudentMockStore } from "@/store/useStudentMockStore";
import OrderStatusBadge from "@/components/ui/OrderStatusBadge";
import SectionHeading from "@/components/ui/SectionHeading";

function StatusBadge({ status }: { status: OrderDetailStatus }) {
  return (
    <OrderStatusBadge
      status={status}
      className={`${styles.badge} ${styles[status]}`}
    />
  );
}

function FoodPlaceholder({ kind }: { kind: "food" | "drink" }) {
  return (
    <div
      className={`${styles.placeholder} ${
        kind === "drink" ? styles.drink : ""
      }`}
      aria-hidden="true"
    >
      {kind === "drink" ? <Milk /> : <Utensils />}
    </div>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionHeading
      icon={icon}
      className={styles.sectionTitle}
      iconClassName={styles.sectionIcon}
    >
      {children}
    </SectionHeading>
  );
}

function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.detailRow} ${className || ""}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function OrderDetailView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const order = useOrderDetail(orderId);
  const reorder = useStudentMockStore((state) => state.reorderDatabaseOrder);

  if (!order) {
    return (
      <div className={styles.page}>
        <div className={`${styles.card} ${styles.empty}`}>
          <h1>Không tìm thấy đơn hàng</h1>
          <p>
            Không tìm thấy đơn #{orderId} trong tài khoản hiện tại.
          </p>
          <Link href="/orders" className={styles.outlineButton}>
            <ArrowLeft size={20} aria-hidden="true" />
            Quay lại đơn hàng
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = order.subtotal;
  const total = order.total;
  const canTrack = order.status === "pending" || order.status === "accepted";

  async function handleReorder() {
    if (!order) return;
    const storeOrder = useStudentMockStore.getState().orderRecords[order.id];
    if (storeOrder) {
      await reorder(order.id);
    }
    router.push("/cart");
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <Link
          href="/orders"
          className={styles.backLink}
          aria-label="Quay lại danh sách đơn hàng"
        >
          <ArrowLeft size={24} strokeWidth={2.3} aria-hidden="true" />
        </Link>
        <div className={styles.headingText}>
          <h1>Chi tiết đơn hàng</h1>
          <p className={styles.desktopSub}>
            Xem đầy đủ thông tin đơn hàng của bạn.
          </p>
          <p className={styles.mobileSub}>Kiểm tra thông tin đơn hàng của bạn</p>
        </div>
      </header>

      <section
        className={`${styles.card} ${styles.summary}`}
        aria-label="Tóm tắt đơn hàng"
      >
        <div className={styles.restaurantImage}>
          <FoodPlaceholder kind={order.kind} />
        </div>

        <div className={styles.summaryContent}>
          <div className={styles.restaurantTitle}>
            <h2>{order.restaurantName}</h2>
            <StatusBadge status={order.status} />
          </div>

          <p className={styles.orderCode}>Đơn hàng #{order.orderCode}</p>

          <div className={styles.metadata}>
            <span>
              <MapPin size={23} aria-hidden="true" />
              {order.restaurantLocation}
            </span>

            <span className={styles.desktopMetaItem}>
              <Utensils size={22} aria-hidden="true" />
              {order.items.length} món
            </span>

            <span className={styles.desktopMetaItem}>
              <CreditCard size={24} aria-hidden="true" />
              {order.payment}
            </span>

            <span>
              <Clock3 size={23} aria-hidden="true" />
              {order.placedAt}
            </span>
          </div>
        </div>

        <div className={styles.summaryTotal}>
          <span>Tổng tiền</span>
          <strong>{formatOrderMoney(total)}</strong>
        </div>
      </section>

      <div className={styles.mobileInfoGrid}>
        <section className={`${styles.card} ${styles.mobileMiniCard}`}>
          <span className={styles.sectionIcon}>
            <MapPin size={18} aria-hidden="true" />
          </span>
          <div className={styles.miniCardBody}>
            <h3>Địa chỉ nhận hàng</h3>
            <p className={styles.miniCardSub}>
              Khu KTX: {order.deliveryLocation}
            </p>
            <p className={styles.miniCardSub}>
              {order.deliveryAddress || "Chưa có địa chỉ nhận hàng."}
            </p>
          </div>
        </section>

        <section className={`${styles.card} ${styles.mobileMiniCard}`}>
          <span className={styles.sectionIcon}>
            <CreditCard size={18} aria-hidden="true" />
          </span>
          <div className={styles.miniCardBody}>
            <h3>Phương thức thanh toán</h3>
            <p className={styles.miniCardSub}>{order.payment}</p>
          </div>
        </section>
      </div>

      <div className={styles.columns}>
        <div className={styles.leftColumn}>
          <section className={`${styles.card} ${styles.itemsCard}`}>
            <div className={styles.itemsHeading}>
              <SectionTitle icon={<Utensils size={23} aria-hidden="true" />}>
                Danh sách món
              </SectionTitle>
            </div>

            <ul className={styles.itemList}>
              {order.items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <div className={styles.itemImage}>
                    <FoodPlaceholder kind={item.kind} />
                  </div>

                  <div className={styles.itemContent}>
                    <h3>{item.name}</h3>

                    {item.options.map((option, index) => (
                      <p key={`${item.id}-${index}`}>+ {option}</p>
                    ))}
                  </div>

                  <span
                    className={styles.quantity}
                    aria-label={`Số lượng ${item.quantity}`}
                  >
                    x{item.quantity}
                  </span>

                  <strong className={styles.itemPrice}>
                    {formatOrderMoney(item.unitPrice * item.quantity)}
                  </strong>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${styles.card} ${styles.noteCard}`}>
            <SectionTitle icon={<ClipboardList size={23} aria-hidden="true" />}>
              Ghi chú đơn hàng
            </SectionTitle>

            <p className={styles.note}>
              {order.note.trim() || "Không có ghi chú."}
            </p>
          </section>

          <div className={`${styles.actions} ${styles.desktopActions}`}>
            <Link href="/orders" className={styles.outlineButton}>
              <ArrowLeft size={23} aria-hidden="true" />
              Quay lại
            </Link>

            {canTrack && (
              <Link
                href={`/orders/${encodeURIComponent(order.id)}/tracking`}
                className={styles.primaryButton}
              >
                <MapPin size={23} aria-hidden="true" />
                Theo dõi đơn
              </Link>
            )}
          </div>
        </div>

        <aside className={styles.rightColumn}>
          <section
            className={`${styles.card} ${styles.sideCard} ${styles.desktopOnlyCard}`}
          >
            <SectionTitle icon={<Info size={23} aria-hidden="true" />}>
              Thông tin đơn hàng
            </SectionTitle>

            <dl className={styles.details}>
              <DetailRow label="Cửa hàng">{order.restaurantName}</DetailRow>
              <DetailRow label="Khu vực">{order.restaurantLocation}</DetailRow>
              <DetailRow label="Số lượng món">{order.quantity} món</DetailRow>
              <DetailRow label="Đặt lúc">{order.placedAt}</DetailRow>
              <DetailRow label="Trạng thái">
                <StatusBadge status={order.status} />
              </DetailRow>
            </dl>
          </section>

          <section
            className={`${styles.card} ${styles.sideCard} ${styles.paymentCard}`}
          >
            <SectionTitle icon={<CreditCard size={23} aria-hidden="true" />}>
              <span className={styles.desktopTitleText}>Thanh toán</span>
              <span className={styles.mobileTitleText}>
                Thông tin thanh toán
              </span>
            </SectionTitle>

            <dl className={styles.details}>
              <DetailRow
                label="Phương thức"
                className={styles.desktopPaymentMethodRow}
              >
                {order.payment}
              </DetailRow>
              <DetailRow label="Tạm tính">
                {formatOrderMoney(subtotal)}
              </DetailRow>
              <DetailRow label="Phí giao hàng">
                {formatOrderMoney(order.deliveryFee)}
              </DetailRow>

              <div className={styles.grandTotal}>
                <dt>Tổng cộng</dt>
                <dd>{formatOrderMoney(total)}</dd>
              </div>
            </dl>
            {order.transferContent && (
              <div className={styles.transferBoxWrapper}>
                <TransferContent value={order.transferContent} />
              </div>
            )}
          </section>

          <section
            className={`${styles.card} ${styles.sideCard} ${styles.desktopOnlyCard}`}
          >
            <SectionTitle icon={<MapPin size={23} aria-hidden="true" />}>
              Địa chỉ nhận hàng
            </SectionTitle>

            <div className={styles.address}>
              <p>{order.deliveryAddress || "Chưa có địa chỉ nhận hàng."}</p>
            </div>
          </section>

          <div className={`${styles.actions} ${styles.mobileBottomActions}`}>
            <button
              type="button"
              className={styles.outlineButton}
              onClick={() => void handleReorder()}
            >
              <RotateCw size={18} strokeWidth={2.2} aria-hidden="true" />
              Đặt lại
            </button>

            <Link
              href={`/orders/${encodeURIComponent(order.id)}/tracking`}
              className={styles.primaryButton}
            >
              <MapPin size={18} strokeWidth={2.2} aria-hidden="true" />
              Theo dõi đơn
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
