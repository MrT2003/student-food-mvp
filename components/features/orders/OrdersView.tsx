"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { useOrders } from "@/lib/orders/useOrders";
import { useReorder } from "@/lib/orders/useReorder";
import { useStudentMockStore } from "@/store/useStudentMockStore";
import { formatMoney } from "@/lib/format";
import OrdersHero from "./OrdersHero";
import OrdersFilterBar from "./OrdersFilterBar";
import CurrentOrderCard from "./CurrentOrderCard";
import HistoryOrderCard from "./HistoryOrderCard";
import {
  cancelPendingOrder,
  computeSummaryCounts,
  defaultOrderSummaryCounts,
  filterOrderCards,
  initialOrderFilters,
  orderStatusLabels,
  previewOrders,
  toOrderCardViewModel,
  type OrderCardViewModel,
  type OrderDateFilter,
  type OrderStatus,
  type OrderStatusFilter,
  type OrderSummaryCounts,
} from "./orders-mock-data";
import styles from "@/styles/orders.module.css";

export * from "./orders-mock-data";

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
      {orderStatusLabels[status]}
    </span>
  );
}

function FoodPlaceholder({
  kind,
  small = false,
}: {
  kind: OrderCardViewModel["kind"];
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

type DesktopOrderCardProps = {
  order: OrderCardViewModel;
  onAction: (orderId: string) => void;
  added?: boolean;
};

function DesktopCurrentOrderCard({ order }: DesktopOrderCardProps) {
  return (
    <article className={styles.currentCard} aria-label={`Đơn hàng ${order.id}`}>
      <FoodPlaceholder kind={order.kind} />

      <div className={styles.orderContent}>
        <div className={styles.orderTitle}>
          <h3>{order.restaurantName}</h3>
          <StatusBadge status={order.status} />
        </div>

        <p className={styles.orderCode}>Đơn hàng #{order.orderCode}</p>

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

            {order.lineCount > 1 && (
              <p>và {order.lineCount - 1} dòng món khác</p>
            )}
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

function DesktopHistoryOrderCard({
  order,
  onAction,
  added,
}: DesktopOrderCardProps) {
  return (
    <article className={styles.historyCard} aria-label={`Đơn hàng ${order.id}`}>
      <div className={styles.historyTop}>
        <FoodPlaceholder kind={order.kind} />

        <div className={styles.historyContent}>
          <div className={styles.historyTitle}>
            <h3>{order.restaurantName}</h3>
            <StatusBadge status={order.status} />
          </div>

          <p className={styles.orderCode}>Đơn hàng #{order.orderCode}</p>

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
          disabled={added}
          onClick={() => onAction(order.id)}
        >
          {added ? "Đã thêm vào giỏ" : "Đặt lại"}
        </button>
      </div>
    </article>
  );
}

type Props = {
  initialOrders?: OrderCardViewModel[];
  initialSummaryCounts?: OrderSummaryCounts;
};

export default function OrdersView({
  initialOrders,
  initialSummaryCounts = defaultOrderSummaryCounts,
}: Props = {}) {
  const { orders: storeRecords } = useOrders();
  const { reorder, addedIds, notice, setNotice } = useReorder();

  const [demoOrders, setDemoOrders] = useState<OrderCardViewModel[]>(
    () => initialOrders ?? previewOrders,
  );
  const [demoCounts, setDemoCounts] = useState<OrderSummaryCounts>(
    () => initialSummaryCounts,
  );
  const [demoAddedIds, setDemoAddedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // State bộ lọc dùng chung cho cả Desktop và Mobile
  const [status, setStatus] = useState<OrderStatusFilter>(
    initialOrderFilters.status,
  );
  const [query, setQuery] = useState<string>(initialOrderFilters.query);
  const [dateFilter, setDateFilter] = useState<OrderDateFilter>(
    initialOrderFilters.dateFilter,
  );

  const hasStoreOrders = !initialOrders && storeRecords.length > 0;

  const activeOrders = useMemo(() => {
    if (hasStoreOrders) {
      return storeRecords.map(toOrderCardViewModel);
    }
    return demoOrders;
  }, [hasStoreOrders, storeRecords, demoOrders]);

  const summaryCounts = useMemo(
    () => computeSummaryCounts(activeOrders, demoCounts, hasStoreOrders),
    [activeOrders, demoCounts, hasStoreOrders],
  );

  const { current: visibleCurrent, history: visibleHistory } = useMemo(
    () =>
      filterOrderCards(activeOrders, {
        status,
        query,
        dateFilter,
      }),
    [activeOrders, status, query, dateFilter],
  );

  const showCurrentSection =
    status === "all" || status === "pending" || status === "accepted";
  const showHistorySection =
    status === "all" || status === "completed" || status === "cancelled";

  function handleSelectStatus(nextStatus: OrderStatusFilter) {
    setStatus(nextStatus);
    setNotice("");
  }

  function handleCancelOrder(orderId: string) {
    const result = cancelPendingOrder(demoOrders, demoCounts, orderId);
    if (result.cancelledOrder) {
      setDemoOrders(result.orders);
      setDemoCounts(result.counts);
      setNotice(`Đã hủy đơn hàng #${result.cancelledOrder.orderCode}.`);
    }
  }

  function handleContactRestaurant(order: OrderCardViewModel) {
    setNotice(
      `Đang kết nối liên hệ với quán ${order.restaurantName} cho đơn #${order.orderCode}.`,
    );
  }

  function handleReorder(orderId: string) {
    const storeOrder = useStudentMockStore.getState().orderRecords[orderId];
    if (storeOrder) {
      reorder(orderId);
      return;
    }

    setDemoAddedIds((prev) => {
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });
    const matched = activeOrders.find((entry) => entry.id === orderId);
    setNotice(
      matched
        ? `Đã thêm món từ quán ${matched.restaurantName} vào giỏ hàng.`
        : "Đã thêm món vào giỏ hàng.",
    );
  }

  function resetFilters() {
    setStatus(initialOrderFilters.status);
    setQuery(initialOrderFilters.query);
    setDateFilter(initialOrderFilters.dateFilter);
    setNotice("");
  }

  return (
    <main className={styles.page}>
      <OrdersHero />

      <OrdersFilterBar
        status={status}
        query={query}
        dateFilter={dateFilter}
        summaryCounts={summaryCounts}
        onStatusChange={handleSelectStatus}
        onQueryChange={setQuery}
        onDateFilterChange={setDateFilter}
      />

      {notice && (
        <div className={styles.notice} role="status">
          <p>{notice}</p>
          <div className={styles.noticeActions}>
            <Link href="/cart">Xem giỏ hàng</Link>
            <button type="button" onClick={() => setNotice("")}>
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Danh sách đơn hàng phiên bản Desktop */}
      <div className={styles.desktopView}>
        {showCurrentSection && (
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
                <DesktopCurrentOrderCard
                  key={order.id}
                  order={order}
                  onAction={handleReorder}
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
                  "các đơn riêng. Mỗi cửa hàng xác nhận và xử lý đơn của mình.",
              )
            }
          >
            Tìm hiểu thêm
            <ArrowRight size={19} aria-hidden="true" />
          </button>
        </aside>

        {showHistorySection && (
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
                <DesktopHistoryOrderCard
                  key={order.id}
                  order={order}
                  onAction={handleReorder}
                  added={addedIds.has(order.id) || demoAddedIds.has(order.id)}
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
      </div>

      {/* Danh sách đơn hàng phiên bản Mobile (Trùng khớp 100% với ảnh mẫu) */}
      <div className={styles.mobileView}>
        {showCurrentSection && (
          <section
            className={styles.mobileSection}
            aria-labelledby="mobile-current-orders-title"
          >
            <div className={styles.mobileSectionHeading}>
              <h2 id="mobile-current-orders-title">
                <span className={styles.mobileSectionIcon}>
                  <CalendarDays
                    size={16}
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                </span>
                <span>Đơn hàng hiện tại</span>
                <span className={styles.mobileCount}>
                  ({visibleCurrent.length})
                </span>
              </h2>
            </div>

            {visibleCurrent.length > 0 ? (
              <div className={styles.mobileCurrentList}>
                {visibleCurrent.map((order) => (
                  <CurrentOrderCard
                    key={order.id}
                    order={order}
                    onCancel={handleCancelOrder}
                    onContact={handleContactRestaurant}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.mobileEmpty}>
                <p>Không có đơn hàng hiện tại phù hợp với bộ lọc.</p>
                {(status !== "all" || query.trim() !== "") && (
                  <button
                    type="button"
                    className={styles.resetButton}
                    onClick={resetFilters}
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {showHistorySection && (
          <section
            className={styles.mobileSection}
            aria-labelledby="mobile-order-history-title"
          >
            <div className={styles.mobileSectionHeading}>
              <h2 id="mobile-order-history-title">
                <span className={styles.mobileSectionIcon}>
                  <Clock3 size={16} strokeWidth={2.2} aria-hidden="true" />
                </span>
                <span>Lịch sử đơn hàng</span>
                <span className={styles.mobileCount}>
                  ({visibleHistory.length})
                </span>
              </h2>

              <Link href="/orders/history" className={styles.mobileTextButton}>
                Xem tất cả
                <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </div>

            {visibleHistory.length > 0 ? (
              <div className={styles.mobileHistoryList}>
                {visibleHistory.map((order) => (
                  <HistoryOrderCard
                    key={order.id}
                    order={order}
                    onAction={handleReorder}
                    added={addedIds.has(order.id) || demoAddedIds.has(order.id)}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.mobileEmpty}>
                <p>Không có lịch sử đơn hàng phù hợp với bộ lọc.</p>
                {(status !== "all" || query.trim() !== "") && (
                  <button
                    type="button"
                    className={styles.resetButton}
                    onClick={resetFilters}
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
