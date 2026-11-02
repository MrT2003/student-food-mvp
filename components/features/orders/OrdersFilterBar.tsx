import {
  CalendarDays,
  ChevronDown,
  CircleCheck,
  CircleX,
  Clock3,
  Search,
} from "lucide-react";
import {
  orderDateOptions,
  orderStatusTabs,
  orderSummaryCards,
  type OrderDateFilter,
  type OrderStatusFilter,
  type OrderSummaryCounts,
} from "./orders-mock-data";
import styles from "@/styles/orders.module.css";

type Props = {
  status: OrderStatusFilter;
  query: string;
  dateFilter: OrderDateFilter;
  summaryCounts: OrderSummaryCounts;
  onStatusChange: (status: OrderStatusFilter) => void;
  onQueryChange: (query: string) => void;
  onDateFilterChange: (dateFilter: OrderDateFilter) => void;
};

function SummaryIcon({ statusKey }: { statusKey: keyof OrderSummaryCounts }) {
  if (statusKey === "pending") {
    return <Clock3 size={18} strokeWidth={2.2} aria-hidden="true" />;
  }
  if (statusKey === "cancelled") {
    return <CircleX size={18} strokeWidth={2.2} aria-hidden="true" />;
  }
  return <CircleCheck size={18} strokeWidth={2.2} aria-hidden="true" />;
}

export default function OrdersFilterBar({
  status,
  query,
  dateFilter,
  summaryCounts,
  onStatusChange,
  onQueryChange,
  onDateFilterChange,
}: Props) {
  return (
    <section className={styles.filterSection} aria-label="Bộ lọc đơn hàng">
      <div
        className={styles.statusTabs}
        role="group"
        aria-label="Trạng thái đơn hàng"
      >
        {orderStatusTabs.map((tab) => {
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              className={`${styles.tabButton} ${active ? styles.tabActive : ""}`}
              onClick={() => onStatusChange(tab.value)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className={styles.searchRow}>
        <label className={styles.searchBox}>
          <Search size={18} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            aria-label="Tìm theo mã đơn hoặc tên quán"
            placeholder="Tìm theo mã đơn hoặc tên quán..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        <label className={styles.dateBox}>
          <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
          <select
            aria-label="Lọc theo ngày đặt hàng"
            value={dateFilter}
            onChange={(event) =>
              onDateFilterChange(event.target.value as OrderDateFilter)
            }
          >
            {orderDateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            strokeWidth={2.2}
            className={styles.dateChevron}
            aria-hidden="true"
          />
        </label>
      </div>

      <div className={styles.summaryGrid} aria-label="Thống kê trạng thái đơn">
        {orderSummaryCards.map((card) => {
          const isSelected = status === card.key;
          return (
            <button
              key={card.key}
              type="button"
              aria-pressed={isSelected}
              className={`${styles.summaryCard} ${isSelected ? styles.summaryCardActive : ""}`}
              onClick={() =>
                onStatusChange(status === card.key ? "all" : card.key)
              }
            >
              <span
                className={`${styles.summaryIconBox} ${styles[`summary_${card.key}`]}`}
              >
                <SummaryIcon statusKey={card.key} />
              </span>
              <span className={styles.summaryText}>
                <span className={styles.summaryLabel}>{card.label}</span>
                <strong className={styles.summaryCount}>
                  {summaryCounts[card.key]}
                </strong>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
