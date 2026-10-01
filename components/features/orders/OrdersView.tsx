"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock3,
  CreditCard,
  History,
  Lightbulb,
  MapPin,
  Milk,
  Utensils,
} from "lucide-react";
import { useOrderPreviewStore } from "@/store/useOrderPreviewStore";
import styles from "@/styles/orders.module.css";
import Link from "next/link";
import {
  formatOrderDate,
  formatOrderPayment,
} from "@/lib/orders/order-mappers";
import { formatMoney } from "@/lib/format";

type OrderStatus =
  | "pending"
  | "accepted"
  | "completed"
  | "cancelled"
  | "rejected";

type Scope = "all" | "current" | "history";
type StatusFilter = "all" | Exclude<OrderStatus, "rejected">;

type Order = {
  id: string;
  restaurantName: string;
  location: string;
  kind: "food" | "drink";
  status: OrderStatus;
  itemCount: number;
  firstItem: string;
  payment: string;
  total: number;
  date: string;
};

const statusLabels: Record<OrderStatus, string> = {
  pending: "Đang chờ xác nhận",
  accepted: "Đã chấp nhận",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  rejected: "Bị từ chối",
};

const currentSamples: Order[] = [
  {
    id: "SF0123",
    restaurantName: "Cơm Cô Ba",
    location: "KTX A",
    kind: "food",
    status: "pending",
    itemCount: 2,
    firstItem: "Cơm gà chiên",
    payment: "Chuyển khoản ngân hàng",
    total: 100000,
    date: "09:42 - 10/09/2026",
  },
  {
    id: "SF0124",
    restaurantName: "Trà Sữa Nhà Làm",
    location: "KTX B",
    kind: "drink",
    status: "accepted",
    itemCount: 2,
    firstItem: "Trà sữa truyền thống",
    payment: "Thanh toán khi nhận món",
    total: 45000,
    date: "09:45 - 10/09/2026",
  },
];

const historySamples: Order[] = [
  {
    id: "SF0108",
    restaurantName: "Cơm Gà 3 Chị Em",
    location: "KTX A",
    kind: "food",
    status: "completed",
    itemCount: 2,
    firstItem: "Cơm gà",
    payment: "Thanh toán khi nhận món",
    total: 78000,
    date: "08/09/2026",
  },
  {
    id: "SF0101",
    restaurantName: "Bún Chả Hà Nội",
    location: "KTX A",
    kind: "food",
    status: "cancelled",
    itemCount: 1,
    firstItem: "Bún chả",
    payment: "Thanh toán khi nhận món",
    total: 52000,
    date: "06/09/2026",
  },
  {
    id: "SF0098",
    restaurantName: "Mì Cay Seoul",
    location: "KTX B",
    kind: "food",
    status: "rejected",
    itemCount: 2,
    firstItem: "Mì cay",
    payment: "Chuyển khoản ngân hàng",
    total: 65000,
    date: "04/09/2026",
  },
];

const scopeOptions: { value: Scope; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "current", label: "Hiện tại" },
  { value: "history", label: "Lịch sử" },
];

const statusOptions: {
  value: Exclude<StatusFilter, "all">;
  label: string;
}[] = [
  { value: "pending", label: "Đang chờ xác nhận" },
  { value: "accepted", label: "Đã chấp nhận" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
];

function StatusIcon({ status }: { status: OrderStatus }) {
  if (status === "pending") {
    return <Clock3 size={19} aria-hidden="true" />;
  }

  if (status === "cancelled" || status === "rejected") {
    return <CircleX size={19} aria-hidden="true" />;
  }

  return <CircleCheck size={19} aria-hidden="true" />;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <StatusIcon status={status} />
      {statusLabels[status]}
    </span>
  );
}

function FoodPlaceholder({
  kind,
  small = false,
}: {
  kind: Order["kind"];
  small?: boolean;
}) {
  return (
    <div
      className={[
        styles.foodPlaceholder,
        kind === "drink" ? styles.drinkPlaceholder : "",
        small ? styles.smallPlaceholder : "",
      ].join(" ")}
      aria-hidden="true"
    >
      {kind === "drink" ? <Milk /> : <Utensils />}
    </div>
  );
}

type OrderCardProps = {
  order: Order;
  onAction: (message: string) => void;
};

function CurrentOrderCard({ order }: OrderCardProps) {
  return (
    <article className={styles.currentCard} aria-label={`Đơn hàng ${order.id}`}>
      <FoodPlaceholder kind={order.kind} />

      <div className={styles.orderContent}>
        <div className={styles.orderTitle}>
          <h3>{order.restaurantName}</h3>
          <StatusBadge status={order.status} />
        </div>

        <p className={styles.orderCode}>Đơn hàng #{order.id}</p>

        <div className={styles.metadata}>
          <span>
            <MapPin size={20} aria-hidden="true" />
            {order.location}
          </span>

          <span>
            <Utensils size={19} aria-hidden="true" />
            {order.itemCount} món
          </span>

          <span>
            <CreditCard size={21} aria-hidden="true" />
            {order.payment}
          </span>
        </div>

        <div className={styles.itemPreview}>
          <FoodPlaceholder kind={order.kind} small />

          <div>
            <strong>{order.firstItem}</strong>

            {order.itemCount > 1 && <p>và {order.itemCount - 1} món khác</p>}
          </div>
        </div>
      </div>

      <div className={styles.orderActions}>
        <span className={styles.muted}>Tổng tiền</span>
        <strong className={styles.total}>{formatMoney(order.total)}</strong>

        <p className={styles.orderDate}>
          <Clock3 size={18} aria-hidden="true" />
          {order.date}
        </p>

        <Link
          href={`/orders/${encodeURIComponent(order.id)}/tracking`}
          className={styles.primaryButton}
        >
          <MapPin size={19} aria-hidden="true" />
          Theo dõi đơn
        </Link>

        <Link
          href={`/orders/${encodeURIComponent(order.id)}`}
          className={styles.outlineButton}
        >
          Xem chi tiết
          <ArrowRight size={19} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function HistoryOrderCard({ order, onAction }: OrderCardProps) {
  return (
    <article className={styles.historyCard} aria-label={`Đơn hàng ${order.id}`}>
      <div className={styles.historyTop}>
        <FoodPlaceholder kind={order.kind} />

        <div className={styles.historyContent}>
          <div className={styles.historyTitle}>
            <h3>{order.restaurantName}</h3>
            <StatusBadge status={order.status} />
          </div>

          <p className={styles.orderCode}>Đơn hàng #{order.id}</p>

          <div className={styles.historyMetadata}>
            <span>
              <CalendarDays size={18} aria-hidden="true" />
              {order.date}
            </span>
            <span>
              <Utensils size={17} aria-hidden="true" />
              {order.itemCount} món
            </span>
          </div>
        </div>
      </div>

      <div className={styles.historyBottom}>
        <div className={styles.historyAmount}>
          <span className={styles.muted}>Tổng tiền</span>
          <strong>{formatMoney(order.total)}</strong>
        </div>

        <Link
          href={`/orders/${encodeURIComponent(order.id)}`}
          className={styles.outlineButton}
        >
          Xem lại
        </Link>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() =>
            onAction(
              `Chưa thể đặt lại đơn #${order.id}: dữ liệu mẫu chưa có ` +
                "đầy đủ món và tùy chọn. Chưa có món nào được thêm vào giỏ.",
            )
          }
        >
          Đặt lại
        </button>
      </div>
    </article>
  );
}

export default function OrdersView() {
  const ordersById = useOrderPreviewStore((state) => state.ordersById);
  const orderIds = useOrderPreviewStore((state) => state.orderIds);

  const [scope, setScope] = useState<Scope>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [notice, setNotice] = useState("");

  // Store hiện chỉ giữ lần xác nhận gần nhất.
  // Nếu chưa có, dùng dữ liệu mẫu để dựng UI.
  const currentOrders = useMemo<Order[]>(() => {
    // Giữ dữ liệu mẫu khi chưa tạo đơn nào.
    if (orderIds.length === 0) {
      return currentSamples;
    }

    return orderIds.flatMap((id): Order[] => {
      const order = ordersById[id];

      if (!order) return [];

      return [
        {
          id: order.id,
          restaurantName: order.restaurantName,
          location: order.restaurantLocation,
          kind: order.kind,
          status: "pending",
          itemCount: order.quantity,
          firstItem: order.items[0]?.name ?? "Món ăn",
          payment: formatOrderPayment(order.payment),
          total: order.total,
          date: formatOrderDate(order.createdAt),
        },
      ];
    });
  }, [ordersById, orderIds]);
  function matchesStatus(order: Order) {
    if (status === "all") return true;

    // Gom đơn bị từ chối vào nhóm không hoàn tất.
    if (status === "cancelled") {
      return order.status === "cancelled" || order.status === "rejected";
    }

    return order.status === status;
  }

  const visibleCurrent = currentOrders.filter(matchesStatus);
  const visibleHistory = historySamples.filter(matchesStatus);

  function selectScope(value: Scope) {
    setScope(value);
    setStatus("all");
    setNotice("");
  }

  function selectStatus(value: Exclude<StatusFilter, "all">) {
    setStatus((previous) => (previous === value ? "all" : value));
    setScope("all");
    setNotice("");
  }

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <h1>Đơn hàng của tôi</h1>
        <p>
          Theo dõi các đơn hàng hiện tại và xem lại lịch sử đặt món của bạn.
        </p>
      </header>

      <div className={styles.filters} aria-label="Bộ lọc đơn hàng">
        <div className={styles.scopeFilters}>
          {scopeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={scope === option.value}
              className={[
                styles.scopeButton,
                scope === option.value ? styles.scopeActive : "",
              ].join(" ")}
              onClick={() => selectScope(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className={styles.filterDivider} aria-hidden="true" />

        <div className={styles.statusFilters}>
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={status === option.value}
              className={[
                styles.statusButton,
                styles[option.value],
                status === option.value ? styles.statusSelected : "",
              ].join(" ")}
              onClick={() => selectStatus(option.value)}
            >
              <StatusIcon status={option.value} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className={styles.notice} role="status">
          <p>{notice}</p>
          <button type="button" onClick={() => setNotice("")}>
            Đóng
          </button>
        </div>
      )}

      {scope !== "history" && (
        <section
          className={styles.section}
          aria-labelledby="current-orders-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="current-orders-title">
              <span className={styles.sectionIcon}>
                <ClipboardList size={22} aria-hidden="true" />
              </span>
              Đơn hàng hiện tại
              <span className={styles.count}>({visibleCurrent.length})</span>
            </h2>
          </div>

          <div className={styles.currentList}>
            {visibleCurrent.map((order) => (
              <CurrentOrderCard
                key={order.id}
                order={order}
                onAction={setNotice}
              />
            ))}
          </div>

          {visibleCurrent.length === 0 && (
            <p className={styles.empty}>
              Không có đơn hàng hiện tại phù hợp với bộ lọc.
            </p>
          )}
        </section>
      )}

      <aside className={styles.infoBanner}>
        <span className={styles.bulbIcon}>
          <Lightbulb size={29} aria-hidden="true" />
        </span>

        <div>
          <h3>Mỗi cửa hàng là một đơn hàng riêng</h3>
          <p>
            Mỗi cửa hàng sẽ tạo một đơn hàng riêng. Bạn có thể theo dõi trạng
            thái đơn hàng của từng cửa hàng trên trang này.
          </p>
        </div>

        <button
          type="button"
          className={styles.outlineButton}
          onClick={() =>
            setNotice(
              "Giỏ hàng có món từ nhiều cửa hàng sẽ được tách thành " +
                "các đơn riêng. Mỗi cửa hàng xác nhận và xử lý đơn của mình. " +
                "Phiên bản hiện tại chỉ hiển thị dữ liệu mẫu.",
            )
          }
        >
          Tìm hiểu thêm
          <ArrowRight size={19} aria-hidden="true" />
        </button>
      </aside>

      {scope !== "current" && (
        <section
          className={styles.section}
          aria-labelledby="order-history-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="order-history-title">
              <span className={styles.sectionIcon}>
                <History size={22} aria-hidden="true" />
              </span>
              Lịch sử đơn hàng
              <span className={styles.count}>({visibleHistory.length})</span>
            </h2>

            <Link href="/orders/history" className={styles.textButton}>
              Xem tất cả
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
          </div>

          <div className={styles.historyGrid}>
            {visibleHistory.map((order) => (
              <HistoryOrderCard
                key={order.id}
                order={order}
                onAction={setNotice}
              />
            ))}
          </div>

          {visibleHistory.length === 0 && (
            <p className={styles.empty}>
              Không có lịch sử đơn hàng phù hợp với bộ lọc.
            </p>
          )}
        </section>
      )}

      <p className={styles.demoNote}>
        Bản xem trước giao diện — chưa kết nối API đơn hàng hoặc cập nhật trạng
        thái thời gian thực.
      </p>
    </main>
  );
}
