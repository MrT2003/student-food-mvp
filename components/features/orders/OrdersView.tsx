"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { useOrders } from "@/lib/orders/useOrders";
import { useReorder } from "@/lib/orders/useReorder";
import { useStudentMockStore } from "@/store/useStudentMockStore";
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
  previewOrders,
  toOrderCardViewModel,
  type OrderCardViewModel,
  type OrderDateFilter,
  type OrderStatusFilter,
  type OrderSummaryCounts,
} from "./orders-mock-data";
import styles from "@/styles/orders.module.css";

export * from "./orders-mock-data";

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
    <div className={styles.page}>
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

      {showCurrentSection && (
        <section
          className={styles.section}
          aria-labelledby="current-orders-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="current-orders-title">
              <span className={styles.sectionIcon}>
                <CalendarDays size={16} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span>Đơn hàng hiện tại</span>
              <span className={styles.count}>({visibleCurrent.length})</span>
            </h2>
          </div>

          {visibleCurrent.length > 0 ? (
            <div className={styles.currentList}>
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
            <div className={styles.empty}>
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
          className={styles.section}
          aria-labelledby="order-history-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="order-history-title">
              <span className={styles.sectionIcon}>
                <Clock3 size={16} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span>Lịch sử đơn hàng</span>
              <span className={styles.count}>({visibleHistory.length})</span>
            </h2>

            <Link href="/orders/history" className={styles.textButton}>
              Xem tất cả
              <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </div>

          {visibleHistory.length > 0 ? (
            <div className={styles.historyGrid}>
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
            <div className={styles.empty}>
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
  );
}
