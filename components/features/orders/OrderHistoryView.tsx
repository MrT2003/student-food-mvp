"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  MapPin,
  Milk,
  Search,
  SlidersHorizontal,
  Utensils,
} from "lucide-react";

import {
  formatOrderMoney,
  mockHistoryOrders,
  orderStatusLabels,
  type OrderDetail,
} from "@/lib/orders/order-detail";
import styles from "@/styles/order-history.module.css";
import { normalizeSearchText as normalize } from "@/lib/format";

type Filter = "all" | "completed" | "cancelled" | "rejected";
type Sort = "newest" | "oldest" | "highest" | "lowest";

const PAGE_SIZE = 8;

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
  { value: "rejected", label: "Bị từ chối" },
];

function getTotal(order: OrderDetail) {
  return (
    order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) +
    order.deliveryFee
  );
}

function getDateLabel(value: string) {
  return value.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] ?? value;
}

function getDateValue(value: string) {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return 0;

  const [, day, month, year] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") {
    return <CircleCheck size={19} aria-hidden="true" />;
  }
  if (status === "rejected") {
    return <Ban size={19} aria-hidden="true" />;
  }
  return <CircleX size={19} aria-hidden="true" />;
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

export default function OrderHistoryView() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");

  const search = normalize(query).replace(/^#/, "");

  const filteredOrders = mockHistoryOrders
    .filter((order) => filter === "all" || order.status === filter)
    .filter(
      (order) =>
        !search ||
        normalize(order.restaurantName).includes(search) ||
        normalize(order.id).includes(search),
    )
    .sort((a, b) => {
      if (sort === "highest") return getTotal(b) - getTotal(a);
      if (sort === "lowest") return getTotal(a) - getTotal(b);

      const difference = getDateValue(b.placedAt) - getDateValue(a.placedAt);

      return sort === "oldest" ? -difference : difference;
    });

  const pageCount = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(1, pageCount));
  const visibleOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function resetFilters() {
    setFilter("all");
    setQuery("");
    setSort("newest");
    setPage(1);
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1>Lịch sử đơn hàng</h1>
        <p>Xem lại các đơn bạn đã đặt trước đây.</p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.filters} aria-label="Lọc trạng thái">
          {filters.map((option) => {
            const count = mockHistoryOrders.filter(
              (order) =>
                option.value === "all" || order.status === option.value,
            ).length;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                className={[
                  styles.filterButton,
                  styles[option.value],
                  filter === option.value ? styles.selected : "",
                ].join(" ")}
                onClick={() => {
                  setFilter(option.value);
                  setPage(1);
                }}
              >
                {option.value !== "all" && <StatusIcon status={option.value} />}
                {option.label} ({count})
              </button>
            );
          })}
        </div>

        <label className={styles.search}>
          <Search size={22} aria-hidden="true" />
          <input
            type="search"
            aria-label="Tìm theo tên quán hoặc mã đơn"
            placeholder="Tìm theo tên quán hoặc mã đơn..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <label className={styles.sort}>
          <SlidersHorizontal size={19} aria-hidden="true" />
          <select
            aria-label="Sắp xếp đơn hàng"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as Sort);
              setPage(1);
            }}
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="highest">Giá cao nhất</option>
            <option value="lowest">Giá thấp nhất</option>
          </select>
        </label>
      </div>

      {notice && (
        <div className={styles.notice} role="status">
          <p>{notice}</p>
          <button type="button" onClick={() => setNotice("")}>
            Đóng
          </button>
        </div>
      )}

      <div className={styles.grid}>
        {visibleOrders.map((order) => {
          const firstItem = order.items[0];

          return (
            <article
              key={order.id}
              className={styles.card}
              aria-label={`Đơn hàng ${order.id}`}
            >
              <div className={styles.restaurantImage}>
                <FoodPlaceholder kind={order.kind} />
              </div>

              <div className={styles.title}>
                <h2>{order.restaurantName}</h2>
                <p>Đơn hàng #{order.id}</p>
              </div>

              <span className={`${styles.badge} ${styles[order.status]}`}>
                <StatusIcon status={order.status} />
                {orderStatusLabels[order.status]}
              </span>

              <div className={styles.metadata}>
                <span>
                  <CalendarDays size={18} aria-hidden="true" />
                  {getDateLabel(order.placedAt)}
                </span>
                <span>
                  <MapPin size={18} aria-hidden="true" />
                  {order.restaurantLocation}
                </span>
                <span>
                  <Utensils size={17} aria-hidden="true" />
                  {order.items.length} món
                </span>
              </div>

              <div className={styles.amount}>
                <span>Tổng tiền</span>
                <strong>{formatOrderMoney(getTotal(order))}</strong>
              </div>

              <div className={styles.preview}>
                <div className={styles.itemImage}>
                  <FoodPlaceholder kind={firstItem?.kind ?? order.kind} />
                </div>
                <div>
                  <strong>{firstItem?.name ?? "Món ăn"}</strong>
                  {order.items.length > 1 && (
                    <p>và {order.items.length - 1} món khác</p>
                  )}
                </div>
              </div>

              <div className={styles.actions}>
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
                    setNotice(
                      `Đặt lại đơn #${order.id} chưa được kết nối. ` +
                        "Cần kiểm tra món, giá và tùy chọn hiện tại của quán " +
                        "trước khi thêm vào giỏ. Chưa có món nào được thêm.",
                    )
                  }
                >
                  Đặt lại
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <section className={styles.empty}>
          <h2>Không tìm thấy đơn hàng</h2>
          <p>Thử tên quán, mã đơn khác hoặc bỏ bộ lọc hiện tại.</p>
          <button
            type="button"
            className={styles.outlineButton}
            onClick={resetFilters}
          >
            Xóa bộ lọc
          </button>
        </section>
      ) : (
        <footer className={styles.footer}>
          <nav className={styles.pagination} aria-label="Phân trang lịch sử">
            <button
              type="button"
              className={styles.pageButton}
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={19} aria-hidden="true" />
              Trước
            </button>

            {Array.from({ length: pageCount }, (_, index) => index + 1).map(
              (number) => (
                <button
                  key={number}
                  type="button"
                  aria-label={`Trang ${number}`}
                  aria-current={currentPage === number ? "page" : undefined}
                  className={`${styles.pageNumber} ${
                    currentPage === number ? styles.activePage : ""
                  }`}
                  onClick={() => setPage(number)}
                >
                  {number}
                </button>
              ),
            )}

            <button
              type="button"
              className={styles.pageButton}
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Tiếp
              <ChevronRight size={19} aria-hidden="true" />
            </button>
          </nav>

          <p className={styles.pageInfo} role="status">
            Trang {currentPage} / {pageCount}
          </p>
        </footer>
      )}
    </div>
  );
}
