"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardList,
  CreditCard,
  Lightbulb,
  MapPin,
  Phone,
  Search,
  SlidersHorizontal,
  User,
  Utensils,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import { useSellerAccess } from "./SellerAccessProvider";
import { useSellerOrders } from "@/lib/seller/useSellerOrders";
import type { SellerManagedOrder } from "@/types/seller-orders.types";
import type { SellerAccess } from "@/types/seller-access.types";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import {
  filterSellerOrders,
  isInSellerTab,
  selectedSellerOrder,
  sellerTabs,
  vietnamDay,
  type SellerOrderTab,
} from "@/lib/seller/orders";
import { formatMoney } from "@/lib/format";
import {
  formatOrderDate,
  formatOrderPayment,
} from "@/lib/orders/order-mappers";
import { orderStatusLabels } from "@/lib/orders/order-detail";
import type { OrderStatus } from "@/types/order.types";
import styles from "@/styles/seller-orders.module.css";

function Badge({ status }: { status: OrderStatus }) {
  const Icon =
    status === "pending"
      ? Clock3
      : status === "rejected" || status === "cancelled"
        ? XCircle
        : CheckCircle2;
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <Icon size={16} />
      {status === "pending" ? "Chờ xác nhận" : orderStatusLabels[status]}
    </span>
  );
}

function Item({ item }: { item: SellerManagedOrder["order_items"][number] }) {
  return (
    <div className={styles.item}>
      {item.image_url ? <Image src={item.image_url} alt={item.item_name_snapshot ?? "Ảnh món đã đặt"} width={52} height={52} unoptimized className={styles.thumb} /> : <FoodThumbnail
        kind="food"
        className={styles.thumb}
      />}
      <div>
        <strong>{item.item_name_snapshot ?? "Chưa có tên món snapshot"}</strong>
        {item.selected_options === null ? <small>Chưa có snapshot lựa chọn thêm</small> : item.selected_options.length > 0 && <small>+ {item.selected_options.map((o) => [o.group_name, o.option_name].filter(Boolean).join(": ")).join(", ")}</small>}
      </div>
      <span className={styles.quantity}>×{item.quantity}</span>
    </div>
  );
}

const money = (value: number | null) => value === null ? "Chưa có số tiền" : formatMoney(value);

export default function SellerOrdersView() {
  const { data, error, retry } = useSellerAccess();
  if (!data?.restaurant) return <div className={styles.page}><StudentHeader variant="seller" /><div className={styles.workspace}><SellerSidebar active="orders" name="" /><main className={styles.content}><p role={error ? "alert" : "status"}>{error || "Đang tải cửa hàng…"}</p>{error && <button onClick={retry}>Thử lại</button>}</main></div></div>;
  // Account/quán đổi: unmount toàn bộ danh sách, bill, request state và bộ lọc cũ.
  return <SellerOrdersContent key={`${data.user.id}:${data.restaurant.id}`} actorId={data.user.id} restaurant={data.restaurant} />;
}

export function SellerOrdersContent({ actorId, restaurant }: { actorId: string; restaurant: NonNullable<SellerAccess["restaurant"]> }) {
  const { orders, loading, refreshError, error, notice, actionError, busyIds, reload, decide, clearNotice } = useSellerOrders(actorId, restaurant.id);
  const [today, setToday] = useState("");
  const [tab, setTab] = useState<SellerOrderTab>("pending");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("today");
  const [sort, setSort] = useState("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ filter: "", page: 1 });
  const bill = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    const refreshDay = () => { if (active) setToday(vietnamDay(new Date().toISOString())); };
    void Promise.resolve().then(refreshDay);
    const timer = window.setInterval(refreshDay, 60_000);
    window.addEventListener("focus", refreshDay);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refreshDay); };
  }, []);
  const filtered = filterSellerOrders(
    orders ?? [],
    restaurant.id,
    query,
    period === "today" ? today : null,
  );
  const visible = filtered
    .filter((o) => isInSellerTab(o.order_status, tab))
    .sort(
      (a, b) =>
        (sort === "newest" ? -1 : 1) *
        (Date.parse(a.created_at) - Date.parse(b.created_at)),
    );
  const selected = selectedSellerOrder(visible, selectedId);
  const filterKey = JSON.stringify([tab, query, period, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 3));
  const page = Math.min(pagination.filter === filterKey ? pagination.page : 1, pageCount);
  const pageOrders = visible.slice((page - 1) * 3, page * 3);
  function goToPage(next: number) {
    setPagination({ filter: filterKey, page: next });
    setSelectedId(null);
  }
  useEffect(() => {
    if (selectedId) bill.current?.focus({ preventScroll: window.matchMedia("(min-width: 1201px)").matches });
  }, [selectedId]);

  function closeBill() {
    setSelectedId(null);
    opener.current?.focus();
  }
  function changeStatus(order: SellerManagedOrder, action: "accept" | "reject" | "complete") {
    if (action === "reject" && !window.confirm(`Từ chối đơn #${order.order_code ?? "chưa có mã"}?`)) return;
    void decide(order.id, action);
  }

  return (
    <div className={styles.page}>
      <StudentHeader variant="seller" />
      <div
        className={styles.workspace}
        data-bill-open={selected ? "true" : "false"}
      >
        <SellerSidebar active="orders" name={restaurant.name} />

        <section className={styles.content}>
          <header className={styles.heading}>
            <h1>Đơn hàng</h1>
            <p>Theo dõi và xử lý đơn hàng của cửa hàng bạn.</p>
          </header>
          <div className={styles.toolbar}>
            <label className={styles.search}>
              <Search size={20} />
              <input
                aria-label="Tìm mã đơn hoặc tên khách hàng"
                placeholder="Tìm theo mã đơn hoặc tên khách hàng..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedId(null);
                }}
              />
            </label>
            <label className={styles.select}>
              <CalendarDays size={20} />
              <select
                aria-label="Thời gian đặt hàng"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setSelectedId(null);
                }}
              >
                <option value="today">Hôm nay</option>
                <option value="all">Tất cả ngày</option>
              </select>
            </label>
          </div>
          <div className={styles.tabs} aria-label="Lọc trạng thái đơn">
            {sellerTabs.map((t) => (
              <button
                key={t.value}
                className={tab === t.value ? styles.activeTab : ""}
                aria-pressed={tab === t.value}
                onClick={() => {
                  setTab(t.value);
                  setSelectedId(null);
                }}
              >
                {t.value === "pending" ? (
                  <Clock3 />
                ) : t.value === "cancelled" ? (
                  <XCircle />
                ) : (
                  <CheckCircle2 />
                )}
                {t.label} ({loading || error || orders === null ? "—" : filtered.filter((o) => isInSellerTab(o.order_status, t.value)).length})
              </button>
            ))}
          </div>
          {(notice || actionError) && (
            <p role={actionError ? "alert" : "status"} className={styles.notice}>
              {actionError || notice}
              <button onClick={clearNotice} aria-label="Đóng thông báo">
                <X size={16} />
              </button>
            </p>
          )}
          <section className={styles.list}>
            <div className={styles.listHeading}>
              <div>
                <h2>
                  <Clock3 />
                  {tab === "pending"
                    ? "Danh sách đơn chờ xác nhận"
                    : `Đơn ${sellerTabs.find((t) => t.value === tab)?.label.toLowerCase()}`}
                </h2>
                <p>{tab === "pending" ? "Các đơn mới cần bạn xác nhận." : "Chọn một đơn để xem đầy đủ thông tin."}</p>
              </div>
              <label className={styles.sort}><SlidersHorizontal size={17} /><span>Sắp xếp:</span><select
                aria-label="Sắp xếp đơn hàng"
                value={sort}
                onChange={(e) => { setSort(e.target.value); setSelectedId(null); }}
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
              </select></label>
            </div>
            {refreshError && <p role="status" aria-live="polite" className={styles.refreshStatus}>{refreshError}</p>}
            <div className={styles.orderList}>
            {loading || !today ? (
              <p role="status" className={styles.empty}>
                Đang tải đơn hàng…
              </p>
            ) : error ? (
              <div className={styles.empty} role="alert"><p>{error}</p><button onClick={() => { void reload(); }}>Thử lại</button></div>
            ) : visible.length === 0 ? (
              <div className={styles.empty}>
                <ClipboardList size={38} />
                <h3>Không có đơn hàng</h3>
                <p>Thử trạng thái, từ khóa hoặc khoảng thời gian khác.</p>
              </div>
            ) : (
              pageOrders.map((order) => (
                <article
                  key={order.id}
                  className={`${styles.order} ${selectedId === order.id ? styles.selected : ""}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    opener.current = e.currentTarget.querySelector("button");
                    setSelectedId(order.id);
                  }}
                >
                  <div className={styles.orderCode}>
                    <button
                      onClick={(e) => {
                        opener.current = e.currentTarget;
                        setSelectedId(order.id);
                      }}
                      aria-label={`Xem đơn ${order.order_code ?? "chưa có mã"}`}
                      aria-expanded={selectedId === order.id}
                      aria-controls="seller-order-bill"
                    >
                      #{order.order_code ?? "Chưa có mã đơn"}
                    </button>
                    <small>{formatOrderDate(order.created_at)}</small>
                    <Badge status={order.order_status} />
                  </div>
                  <div className={styles.orderBody}>
                    <div className={styles.meta}>
                      <div>
                        <strong>
                          <User size={16} />
                          {order.customer.name ?? "Chưa có tên khách"}
                        </strong>
                        <span>
                          <Phone size={16} />
                          {order.customer.phone ?? (order.order_status === "completed" ? "Đã ẩn số điện thoại" : "Chưa có số điện thoại")}
                        </span>
                      </div>
                      <span className={styles.address}>
                        <MapPin size={17} />
                        <span>{order.delivery_address ?? "Chưa có địa chỉ giao nhận"}</span>
                      </span>
                      <span>
                        <ClipboardList size={17} />
                        {order.order_items.reduce(
                          (sum, i) => sum + i.quantity,
                          0,
                        )}{" "}
                        món
                      </span>
                      <span>
                        <CreditCard size={17} />
                        {formatOrderPayment(order.payment_method)}
                      </span>
                    </div>
                    <div className={styles.itemPreview}>
                      {order.order_items.slice(0, 2).map((item) => (
                        <Item key={item.id} item={item} />
                      ))}
                      {order.order_items.length > 2 && (
                        <small className={styles.moreItems}><b>+{order.order_items.length - 2}</b> món khác</small>
                      )}
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <strong>{money(order.total)}</strong>
                    <div>
                      {order.order_status === "pending" && (
                        <>
                          <button
                            className={styles.primary}
                            disabled={loading || busyIds.includes(order.id)}
                            onClick={() => changeStatus(order, "accept")}
                          >
                            Chấp nhận
                          </button>
                          <button
                            className={styles.outline}
                            disabled={loading || busyIds.includes(order.id)}
                            onClick={() => changeStatus(order, "reject")}
                          >
                            Từ chối
                          </button>
                        </>
                      )}
                      {order.order_status === "accepted" && (
                        <button
                          className={styles.primary}
                          disabled={loading || busyIds.includes(order.id)}
                          onClick={() => changeStatus(order, "complete")}
                        >
                          Hoàn thành
                        </button>
                      )}
                    </div>
                    <button
                      className={styles.detailLink}
                      aria-expanded={selectedId === order.id}
                      aria-controls="seller-order-bill"
                      onClick={(e) => {
                        opener.current = e.currentTarget;
                        setSelectedId(order.id);
                      }}
                    >
                      Xem chi tiết
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </article>
              ))
            )}
            </div>
            {!loading && !error && pageCount > 1 && <nav className={styles.pagination} aria-label="Phân trang đơn hàng"><span>{visible.length} đơn · Trang {page}/{pageCount}</span><div><button disabled={page === 1} onClick={() => goToPage(page - 1)}>Trước</button><button disabled={page === pageCount} onClick={() => goToPage(page + 1)}>Sau</button></div></nav>}
          </section>
          <p className={styles.demo}>Số lượng tab theo toàn bộ đơn của quán đã tải, cùng từ khóa/ngày đang chọn. Ngày tính theo giờ Việt Nam.</p>
        </section>

        {selected ? (
          <aside
            id="seller-order-bill"
            ref={bill}
            tabIndex={-1}
            className={styles.bill}
            aria-label={`Chi tiết đơn ${selected.order_code ?? "chưa có mã"}`}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeBill();
            }}
          >
            <div className={styles.billHeading}>
              <h2>Chi tiết đơn hàng</h2>
              <button onClick={closeBill} aria-label="Đóng chi tiết đơn hàng">
                <X />
              </button>
            </div>
            <section>
              <div className={styles.billTitle}>
                <strong>#{selected.order_code ?? "Chưa có mã đơn"}</strong>
                <Badge status={selected.order_status} />
              </div>
              <p>Đặt lúc: {formatOrderDate(selected.created_at)}</p>
            </section>
            <section>
              <h3>
                <User />
                Thông tin khách hàng
              </h3>
              <strong>{selected.customer.name ?? "Chưa có tên khách"}</strong>
              <p>
                <Phone size={16} />
                {selected.customer.phone ?? (selected.order_status === "completed" ? "Đã ẩn số điện thoại" : "Chưa có số điện thoại")}
              </p>
              <p>
                <MapPin size={16} />
                {selected.delivery_address ?? "Chưa có địa chỉ giao nhận"}
              </p>
            </section>
            <section>
              <h3>
                <Wallet />
                Thông tin thanh toán
              </h3>
              <p>{formatOrderPayment(selected.payment_method)}</p>
            </section>
            <section>
              <h3>
                <Utensils />
                Danh sách món
              </h3>
              {selected.order_items.map((item) => (
                <div className={styles.billItem} key={item.id}>
                  <Item item={item} />
                  <strong>
                    {item.total_price === null ? `Giá món snapshot: ${money(item.unit_price_snapshot)}; chưa có đơn giá đầy đủ` : `${money(item.total_price)}/phần`}
                  </strong>
                </div>
              ))}
            </section>
            <section>
              <h3>
                <ClipboardList />
                Ghi chú của khách hàng
              </h3>
              <p className={styles.note}>
                {selected.customer_notes || "Không có ghi chú."}
              </p>
            </section>
            <section className={styles.totals}>
              <p>
                <span>Tạm tính</span>
                <span>{money(selected.subtotal)}</span>
              </p>
              <p>
                <strong>Tổng cộng</strong>
                <strong>{money(selected.total)}</strong>
              </p>
            </section>
          </aside>
        ) : (
          <aside className={styles.help}>
            <span className={styles.helpIcon}>
              <Lightbulb />
            </span>
            <h2>Chỉ hiển thị một trạng thái</h2>
            <p>
              Khi bạn chọn một trạng thái, chỉ danh sách của trạng thái đó sẽ
              hiển thị.
            </p>
            <div className={styles.helpRows} aria-hidden="true">
              {sellerTabs.map((t) => (
                <div key={t.value} data-status={t.value}>
                  {t.value === "pending" ? <Clock3 /> : t.value === "cancelled" ? <XCircle /> : <CheckCircle2 />}
                  <span />
                </div>
              ))}
            </div>
            <p>
              Nhấn mã đơn hoặc “Xem chi tiết” để mở bill. Chuyển tab để xem các
              đơn đã xử lý nhé!
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
