"use client";

import { useEffect, useRef, useState } from "react";
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
  User,
  Utensils,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import { useSellerPreview } from "@/store/useSellerPreviewStore";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import {
  createSellerOrderFixtures,
  demoSellerRestaurant,
} from "@/lib/mocks/seller-orders.mock";
import {
  filterSellerOrders,
  isInSellerTab,
  selectedSellerOrder,
  sellerTabs,
  transitionSellerOrder,
  vietnamDay,
  type SellerOrder,
  type SellerOrderTab,
} from "@/lib/seller/orders";
import { formatMoney, normalizeSearchText } from "@/lib/format";
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
      {orderStatusLabels[status]}
    </span>
  );
}

function Item({ item }: { item: SellerOrder["order_items"][number] }) {
  return (
    <div className={styles.item}>
      <FoodThumbnail
        kind={
          normalizeSearchText(item.item_name_snapshot).includes("tra")
            ? "drink"
            : "food"
        }
        className={styles.thumb}
      />
      <div>
        <strong>{item.item_name_snapshot}</strong>
        {item.option_snapshot_price.map((o) => (
          <small key={o.option_id}>+ {o.option_name}</small>
        ))}
      </div>
      <span className={styles.quantity}>×{item.quantity}</span>
    </div>
  );
}

export default function SellerOrdersView() {
  const draft = useSellerPreview();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [today, setToday] = useState("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<SellerOrderTab>("pending");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("today");
  const [sort, setSort] = useState("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const bill = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Initialize only in the browser to avoid date/time hydration differences.
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const now = new Date().toISOString();
      setOrders(createSellerOrderFixtures(now));
      setToday(vietnamDay(now));
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  const filtered = filterSellerOrders(
    draft ? [] : orders,
    demoSellerRestaurant.id,
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
  useEffect(() => {
    if (selectedId) bill.current?.focus();
  }, [selectedId]);

  function closeBill() {
    setSelectedId(null);
    opener.current?.focus();
  }
  function changeStatus(order: SellerOrder, status: OrderStatus) {
    if (
      status === "rejected" &&
      !window.confirm(`Từ chối đơn #${order.order_code}? (Chỉ dữ liệu demo)`)
    )
      return;
    setOrders((current) =>
      current.map((o) =>
        o.id === order.id
          ? transitionSellerOrder(o, status, new Date().toISOString())
          : o,
      ),
    );
    setSelectedId(null);
    setNotice(
      `Đơn #${order.order_code}: ${orderStatusLabels[status]}. Chỉ cập nhật bản demo.`,
    );
  }

  return (
    <div className={styles.page}>
      <StudentHeader />
      <div
        className={styles.workspace}
        data-bill-open={selected ? "true" : "false"}
      >
        <SellerSidebar active="orders" name={draft?.name || demoSellerRestaurant.name} />

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
                {t.label} (
                {
                  filtered.filter((o) => isInSellerTab(o.order_status, t.value))
                    .length
                }
                )
              </button>
            ))}
          </div>
          {notice && (
            <p role="status" className={styles.notice}>
              {notice}
              <button onClick={() => setNotice("")} aria-label="Đóng thông báo">
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
                <p>Chọn một đơn để xem đầy đủ thông tin.</p>
              </div>
              <select
                aria-label="Sắp xếp đơn hàng"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
              </select>
            </div>
            {!ready ? (
              <p role="status" className={styles.empty}>
                Đang tải đơn hàng…
              </p>
            ) : visible.length === 0 ? (
              <div className={styles.empty}>
                <ClipboardList size={38} />
                <h3>Không có đơn hàng</h3>
                <p>Thử trạng thái, từ khóa hoặc khoảng thời gian khác.</p>
              </div>
            ) : (
              visible.map((order) => (
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
                      aria-label={`Xem đơn ${order.order_code}`}
                      aria-expanded={selectedId === order.id}
                      aria-controls="seller-order-bill"
                    >
                      #{order.order_code}
                    </button>
                    <small>{formatOrderDate(order.created_at)}</small>
                    <Badge status={order.order_status} />
                  </div>
                  <div className={styles.orderBody}>
                    <div className={styles.meta}>
                      <div>
                        <strong>
                          <User size={16} />
                          {order.customer.name}
                        </strong>
                        <span>
                          <Phone size={16} />
                          {order.customer.phone ?? "Đã ẩn số điện thoại"}
                        </span>
                      </div>
                      <span>
                        <MapPin size={17} />
                        {order.delivery_address}
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
                        {order.payment_method === "cash"
                          ? "Tiền mặt"
                          : "Chuyển khoản"}
                      </span>
                    </div>
                    <div className={styles.itemPreview}>
                      {order.order_items.slice(0, 2).map((item) => (
                        <Item key={item.id} item={item} />
                      ))}
                      {order.order_items.length > 2 && (
                        <small>+{order.order_items.length - 2} món khác</small>
                      )}
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <strong>{formatMoney(order.total)}</strong>
                    <div>
                      {order.order_status === "pending" && (
                        <>
                          <button
                            className={styles.primary}
                            onClick={() => changeStatus(order, "accepted")}
                          >
                            Chấp nhận
                          </button>
                          <button
                            className={styles.outline}
                            onClick={() => changeStatus(order, "rejected")}
                          >
                            Từ chối
                          </button>
                        </>
                      )}
                      {order.order_status === "accepted" && (
                        <button
                          className={styles.primary}
                          onClick={() => changeStatus(order, "completed")}
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
          </section>
          <p className={styles.demo}>
            Bản demo UI · Không phải đơn thật. Thay đổi trạng thái sẽ mất khi
            tải lại trang.
          </p>
        </section>

        {selected ? (
          <aside
            id="seller-order-bill"
            ref={bill}
            tabIndex={-1}
            className={styles.bill}
            aria-label={`Chi tiết đơn ${selected.order_code}`}
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
                <strong>#{selected.order_code}</strong>
                <Badge status={selected.order_status} />
              </div>
              <p>Đặt lúc: {formatOrderDate(selected.created_at)}</p>
            </section>
            <section>
              <h3>
                <User />
                Thông tin khách hàng
              </h3>
              <strong>{selected.customer.name}</strong>
              <p>
                <Phone size={16} />
                {selected.customer.phone ?? "Đã ẩn số điện thoại"}
              </p>
              <p>
                <MapPin size={16} />
                {selected.delivery_address}
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
                    {formatMoney(item.unit_price_snapshot * item.quantity)}
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
                <span>{formatMoney(selected.subtotal)}</span>
              </p>
              <p>
                <span>Phí giao hàng (demo)</span>
                <span>{formatMoney(selected.total - selected.subtotal)}</span>
              </p>
              <p>
                <strong>Tổng cộng</strong>
                <strong>{formatMoney(selected.total)}</strong>
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
                <div key={t.value}>
                  <CheckCircle2 />
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
