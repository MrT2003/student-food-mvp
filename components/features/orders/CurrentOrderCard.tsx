import Link from "next/link";
import {
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  Phone,
  Utensils,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import OrderFoodMedia from "./OrderFoodMedia";
import {
  orderStatusLabels,
  type OrderCardViewModel,
  type OrderStatus,
} from "./orders-mock-data";
import styles from "@/styles/orders.module.css";

type Props = {
  order: OrderCardViewModel;
  onCancel?: (orderId: string) => void;
  onContact?: (order: OrderCardViewModel) => void;
};

function CurrentStatusBadge({ status }: { status: OrderStatus }) {
  const Icon =
    status === "pending"
      ? Clock3
      : status === "cancelled" || status === "rejected"
        ? CircleX
        : CircleCheck;

  return (
    <span className={`${styles.mobileBadge} ${styles[status]}`}>
      <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
      {orderStatusLabels[status]}
    </span>
  );
}

export default function CurrentOrderCard({
  order,
  onCancel,
  onContact,
}: Props) {
  return (
    <article
      className={styles.mobileCurrentCard}
      aria-label={`Đơn hàng ${order.orderCode}`}
    >
      <div className={styles.currentTop}>
        <OrderFoodMedia
          artwork={order.artwork}
          kind={order.kind}
          imageUrl={order.imageUrl}
          className={styles.currentThumb}
        />

        <div className={styles.orderContent}>
          <div className={styles.orderTitleRow}>
            <h3>{order.restaurantName}</h3>
            <div className={styles.orderBadgeGroup}>
              <CurrentStatusBadge status={order.status} />
              <Link
                href={`/orders/${encodeURIComponent(order.id)}`}
                className={styles.cardChevron}
                aria-label={`Mở chi tiết đơn ${order.orderCode}`}
              >
                <ChevronRight size={17} strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <p className={styles.mobileOrderCode}>Đơn hàng #{order.orderCode}</p>

          <div className={styles.mobileMetadata}>
            <span>
              <MapPin size={14} strokeWidth={2} aria-hidden="true" />
              {order.location}
            </span>

            <span>
              <Utensils size={14} strokeWidth={2} aria-hidden="true" />
              {order.itemCount} món
            </span>

            <span>
              <CreditCard size={14} strokeWidth={2} aria-hidden="true" />
              {order.paymentShort}
            </span>
          </div>

          <div className={styles.previewAndTotal}>
            <div className={styles.mobileItemPreview}>
              <OrderFoodMedia
                artwork={order.itemArtwork}
                kind={order.kind}
                imageUrl={order.itemImageUrl}
                small
                className={styles.mobileSmallPlaceholder}
              />

              <div className={styles.itemPreviewText}>
                <strong>{order.firstItem}</strong>
                {order.otherItemCount > 0 && (
                  <p>và {order.otherItemCount} món khác</p>
                )}
              </div>
            </div>

            <div className={styles.totalBlock}>
              <span className={styles.mobileMuted}>Tổng tiền</span>
              <strong className={styles.mobileTotal}>
                {formatMoney(order.total)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.currentActions}>
        {order.status === "pending" ? (
          <button
            type="button"
            className={styles.outlineButton}
            onClick={() => onCancel?.(order.id)}
          >
            <CircleX size={15} strokeWidth={2} aria-hidden="true" />
            Hủy đơn
          </button>
        ) : (
          <button
            type="button"
            className={styles.outlineButton}
            onClick={() => onContact?.(order)}
          >
            <Phone size={15} strokeWidth={2} aria-hidden="true" />
            Liên hệ quán
          </button>
        )}

        <Link
          href={`/orders/${encodeURIComponent(order.id)}`}
          className={styles.outlineButton}
        >
          <FileText size={15} strokeWidth={2} aria-hidden="true" />
          Xem chi tiết
        </Link>
      </div>
    </article>
  );
}
