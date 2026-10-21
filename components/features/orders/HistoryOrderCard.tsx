import Link from "next/link";
import {
  CalendarDays,
  CircleCheck,
  CircleX,
  Clock3,
  CreditCard,
  RotateCcw,
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
  onAction: (orderId: string) => void;
  added?: boolean;
};

function HistoryStatusBadge({ status }: { status: OrderStatus }) {
  const Icon =
    status === "pending"
      ? Clock3
      : status === "cancelled" || status === "rejected"
        ? CircleX
        : CircleCheck;

  return (
    <span className={`${styles.badge} ${styles.historyBadge} ${styles[status]}`}>
      <Icon size={13} strokeWidth={2.2} aria-hidden="true" />
      {orderStatusLabels[status]}
    </span>
  );
}

export default function HistoryOrderCard({ order, onAction, added }: Props) {
  const isCompleted = order.status === "completed";

  return (
    <article
      className={styles.historyCard}
      aria-label={`Đơn hàng ${order.orderCode}`}
    >
      <div className={styles.historyTop}>
        <OrderFoodMedia
          artwork={order.artwork}
          kind={order.kind}
          imageUrl={order.imageUrl}
          className={styles.historyThumb}
        />

        <div className={styles.historyContent}>
          <div className={styles.historyTitle}>
            <h3>{order.restaurantName}</h3>
            <HistoryStatusBadge status={order.status} />
          </div>

          <p className={styles.orderCode}>Đơn hàng #{order.orderCode}</p>

          <div className={styles.historyMetadata}>
            <span>
              <CalendarDays size={13} strokeWidth={2} aria-hidden="true" />
              {order.dateShort}
            </span>
            <span>
              <Utensils size={13} strokeWidth={2} aria-hidden="true" />
              {order.itemCount} món
            </span>
            <span>
              <CreditCard size={13} strokeWidth={2} aria-hidden="true" />
              {order.paymentShort}
            </span>
          </div>
        </div>

        <div className={styles.historyAmount}>
          <span className={styles.muted}>Tổng tiền</span>
          <strong className={styles.historyTotal}>
            {formatMoney(order.total)}
          </strong>
        </div>
      </div>

      <div className={styles.historyBottom}>
        <Link
          href={`/orders/${encodeURIComponent(order.id)}`}
          className={styles.outlineButton}
        >
          Xem chi tiết
        </Link>

        <button
          type="button"
          className={
            isCompleted ? styles.primaryButton : styles.outlineButton
          }
          disabled={added}
          onClick={() => onAction(order.id)}
        >
          <RotateCcw size={15} strokeWidth={2.2} aria-hidden="true" />
          {added ? "Đã thêm vào giỏ" : "Đặt lại"}
        </button>
      </div>
    </article>
  );
}
