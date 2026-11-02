"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ClipboardList,
  CreditCard,
  FileText,
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
import { useSellerPreview } from "@/store/useSellerPreviewStore";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import TransferContent from "@/components/ui/TransferContent";
import { formatTransferContent } from "@/lib/orders/order-code";
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
import { formatMoney } from "@/lib/format";
import { normalizeSearchText } from "@/lib/format";
import {
  formatOrderDate,
  formatOrderPayment,
} from "@/lib/orders/order-mappers";
import { orderStatusLabels } from "@/lib/orders/order-detail";
import type { OrderStatus, PaymentMethod } from "@/types/order.types";
import styles from "@/styles/seller-orders.module.css";

export const SELLER_MOBILE_REFERENCE_DAY = "2026-10-05";

export const sellerMobileOrderTabs: readonly {
  value: SellerOrderTab;
  label: string;
}[] = [
  { value: "pending", label: "Chờ xác nhận" },
  { value: "accepted", label: "Đã nhận" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
] as const;

export const sellerMobileDateFilterOptions = [
  { value: "today", label: "Hôm nay" },
  { value: "all", label: "Tất cả ngày" },
] as const;

export const sellerMobileSortOptions = [
  { value: "newest", label: "Mới nhất trước" },
  { value: "oldest", label: "Cũ nhất trước" },
] as const;

export function formatMobileOrderTime(dateIso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dateIso));
}

export function splitMobileDeliveryAddress(address: string | null): {
  area: string;
  detail: string;
} {
  const raw = (address ?? "Chưa có địa chỉ").trim();
  const [first, ...rest] = raw.split(",");
  return {
    area: first.trim(),
    detail: rest.join(",").trim(),
  };
}

export function formatMobileOrderItemsSummary(
  items: SellerOrder["order_items"],
): string {
  const preview = items
    .slice(0, 2)
    .map((item) => `${item.quantity}× ${item.item_name_snapshot}`);
  if (items.length > 2) {
    preview.push(`+${items.length - 2} món`);
  }
  return preview.join(" · ");
}

export function getMobileOrderNoteBadge(
  order: SellerOrder,
): "Có tùy chọn món" | "Có ghi chú" | null {
  if (order.order_items.some((item) => item.selected_options.length > 0)) {
    return "Có tùy chọn món";
  }
  if (order.customer_notes && order.customer_notes.trim().length > 0) {
    return "Có ghi chú";
  }
  return null;
}

export function getSellerMobileTabCounts(
  orders: SellerOrder[],
): Record<SellerOrderTab, number> {
  return {
    pending: orders.filter((o) => isInSellerTab(o.order_status, "pending"))
      .length,
    accepted: orders.filter((o) => isInSellerTab(o.order_status, "accepted"))
      .length,
    completed: orders.filter((o) => isInSellerTab(o.order_status, "completed"))
      .length,
    cancelled: orders.filter((o) => isInSellerTab(o.order_status, "cancelled"))
      .length,
  };
}

export function filterAndSortSellerMobileOrders(
  orders: SellerOrder[],
  options: {
    restaurantId?: string;
    tab: SellerOrderTab;
    query: string;
    period: string;
    sort: string;
    day?: string | null;
  },
): SellerOrder[] {
  const restaurantId = options.restaurantId ?? demoSellerRestaurant.id;
  const targetDay =
    options.period === "today"
      ? (options.day ?? SELLER_MOBILE_REFERENCE_DAY)
      : null;
  const filtered = filterSellerOrders(
    orders,
    restaurantId,
    options.query,
    targetDay,
  );
  return filtered
    .filter((order) => isInSellerTab(order.order_status, options.tab))
    .sort(
      (a, b) =>
        (options.sort === "newest" ? -1 : 1) *
        (Date.parse(a.created_at) - Date.parse(b.created_at)),
    );
}

function buildMobileOrder(params: {
  id: string;
  orderCode: string;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  deliveryAddress: string;
  paymentMethod: PaymentMethod;
  customerNotes: string | null;
  items: {
    id: string;
    menuItemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    hasOption?: boolean;
  }[];
}): SellerOrder {
  const orderItems: SellerOrder["order_items"] = params.items.map((item) => ({
    id: item.id,
    order_id: params.id,
    menu_item_id: item.menuItemId,
    item_name_snapshot: item.name,
    unit_price_snapshot: item.unitPrice,
    quantity: item.quantity,
    selected_options: item.hasOption
      ? [
          {
            option_id: `${item.id}-opt-1`,
            group_name: "Tùy chọn món",
            option_name: "Ít đường",
            additional_price: 0,
          },
        ]
      : [],
    image_url: null,
  }));
  const total = orderItems.reduce(
    (sum, item) => sum + item.unit_price_snapshot * item.quantity,
    0,
  );
  return {
    id: params.id,
    restaurant_id: demoSellerRestaurant.id,
    student_id: `51000000-0000-4000-8000-${params.id.slice(-12)}`,
    session_checkout_id: `91000000-0000-4000-8000-${params.id.slice(-12)}`,
    order_code: params.orderCode,
    order_status: params.status,
    payment_method: params.paymentMethod,
    payment_confirmed_at: null,
    payment_confirmed_by: null,
    subtotal: total,
    total,
    delivery_address: params.deliveryAddress,
    customer_notes: params.customerNotes,
    created_at: params.createdAt,
    accepted_at:
      params.status === "accepted" || params.status === "completed"
        ? params.createdAt
        : null,
    completed_at: params.status === "completed" ? params.createdAt : null,
    order_items: orderItems,
    customer: {
      name: params.customerName,
      phone: params.status === "completed" ? null : params.customerPhone,
    },
  };
}

export function createSellerMobileOrderFixtures(): SellerOrder[] {
  const pendingOrders: SellerOrder[] = [
    buildMobileOrder({
      id: "71000000-0000-4000-8000-000000000128",
      orderCode: "SF0128",
      status: "pending",
      createdAt: "2026-10-05T03:24:00.000Z", // 10:24 ICT
      customerName: "Trần Minh Anh",
      customerPhone: "0901 234 567",
      deliveryAddress: "KTX A, Cổng B, Phòng 302",
      paymentMethod: "cash",
      customerNotes: null,
      items: [
        {
          id: "81000000-0000-4000-8000-000000001281",
          menuItemId: "20000000-0000-4000-8000-000000000003",
          name: "Trà sữa truyền thống",
          unitPrice: 25000,
          quantity: 1,
          hasOption: true,
        },
        {
          id: "81000000-0000-4000-8000-000000001282",
          menuItemId: "20000000-0000-4000-8000-000000000002",
          name: "Bánh tráng trộn",
          unitPrice: 20000,
          quantity: 1,
        },
      ],
    }),
    buildMobileOrder({
      id: "71000000-0000-4000-8000-000000000129",
      orderCode: "SF0129",
      status: "pending",
      createdAt: "2026-10-05T02:56:00.000Z", // 09:56 ICT
      customerName: "Lê Quốc Bảo",
      customerPhone: "0902 345 678",
      deliveryAddress: "KTX C, Tòa C1, Phòng 410",
      paymentMethod: "cash",
      customerNotes: null,
      items: [
        {
          id: "81000000-0000-4000-8000-000000001291",
          menuItemId: "20000000-0000-4000-8000-000000000001",
          name: "Cơm gà xối mỡ",
          unitPrice: 28000,
          quantity: 1,
        },
      ],
    }),
    buildMobileOrder({
      id: "71000000-0000-4000-8000-000000000130",
      orderCode: "SF0130",
      status: "pending",
      createdAt: "2026-10-05T02:20:00.000Z", // 09:20 ICT
      customerName: "Phạm Thị Mai",
      customerPhone: "0903 456 789",
      deliveryAddress: "KTX B, Tòa B2, Phòng 205",
      paymentMethod: "bank_transfer",
      customerNotes: "Gọi trước khi giao xuống sảnh giúp mình nhé!",
      items: [
        {
          id: "81000000-0000-4000-8000-000000001301",
          menuItemId: "20000000-0000-4000-8000-000000000004",
          name: "Bún bò Huế",
          unitPrice: 35000,
          quantity: 1,
        },
        {
          id: "81000000-0000-4000-8000-000000001302",
          menuItemId: "20000000-0000-4000-8000-000000000005",
          name: "Trà tắc",
          unitPrice: 12000,
          quantity: 1,
        },
        {
          id: "81000000-0000-4000-8000-000000001303",
          menuItemId: "20000000-0000-4000-8000-000000000006",
          name: "Chả giò thêm",
          unitPrice: 15000,
          quantity: 1,
        },
      ],
    }),
  ];

  const acceptedOrders: SellerOrder[] = Array.from({ length: 5 }, (_, idx) => {
    const codeNum = 123 + idx;
    return buildMobileOrder({
      id: `71000000-0000-4000-8000-000000000${codeNum}`,
      orderCode: `SF0${codeNum}`,
      status: "accepted",
      createdAt: new Date(
        Date.parse("2026-10-05T02:00:00.000Z") - idx * 300_000,
      ).toISOString(),
      customerName: [
        "Nguyễn Hoàng Nam",
        "Đỗ Thảo Vy",
        "Võ Minh Khôi",
        "Bùi Thanh Hà",
        "Hoàng Gia Huy",
      ][idx],
      customerPhone: "0904 567 890",
      deliveryAddress: [
        "KTX A, Tòa A2, Phòng 105",
        "KTX B, Tòa B1, Phòng 308",
        "KTX A, Cổng A, Phòng 210",
        "KTX C, Tòa C2, Phòng 402",
        "KTX B, Tòa B3, Phòng 112",
      ][idx],
      paymentMethod: idx % 2 === 0 ? "cash" : "bank_transfer",
      customerNotes: null,
      items: [
        {
          id: `81000000-0000-4000-8000-00000000${codeNum}1`,
          menuItemId: "20000000-0000-4000-8000-000000000001",
          name: "Cơm gà xối mỡ",
          unitPrice: 30000,
          quantity: 1,
        },
      ],
    });
  });

  const completedOrders: SellerOrder[] = Array.from(
    { length: 18 },
    (_, idx) => {
      const codeNum = 105 + idx;
      return buildMobileOrder({
        id: `71000000-0000-4000-8000-000000000${codeNum}`,
        orderCode: `SF0${codeNum}`,
        status: "completed",
        createdAt: new Date(
          Date.parse("2026-10-05T01:30:00.000Z") - idx * 120_000,
        ).toISOString(),
        customerName: `Sinh viên #${idx + 1}`,
        customerPhone: null,
        deliveryAddress: "KTX A, Cổng B, Phòng 201",
        paymentMethod: idx % 3 === 0 ? "bank_transfer" : "cash",
        customerNotes: null,
        items: [
          {
            id: `81000000-0000-4000-8000-00000000${codeNum}1`,
            menuItemId: "20000000-0000-4000-8000-000000000001",
            name: "Cơm sườn nướng",
            unitPrice: 32000,
            quantity: 1,
          },
        ],
      });
    },
  );

  const cancelledOrders: SellerOrder[] = [
    buildMobileOrder({
      id: "71000000-0000-4000-8000-000000000103",
      orderCode: "SF0103",
      status: "cancelled",
      createdAt: "2026-10-05T00:50:00.000Z",
      customerName: "Đặng Minh Tuấn",
      customerPhone: "0908 111 222",
      deliveryAddress: "KTX B, Tòa B1, Phòng 104",
      paymentMethod: "cash",
      customerNotes: null,
      items: [
        {
          id: "81000000-0000-4000-8000-000000001031",
          menuItemId: "20000000-0000-4000-8000-000000000003",
          name: "Trà sữa truyền thống",
          unitPrice: 25000,
          quantity: 1,
        },
      ],
    }),
    buildMobileOrder({
      id: "71000000-0000-4000-8000-000000000104",
      orderCode: "SF0104",
      status: "rejected",
      createdAt: "2026-10-05T00:40:00.000Z",
      customerName: "Ngô Bảo Châu",
      customerPhone: "0908 333 444",
      deliveryAddress: "KTX C, Tòa C2, Phòng 305",
      paymentMethod: "bank_transfer",
      customerNotes: null,
      items: [
        {
          id: "81000000-0000-4000-8000-000000001041",
          menuItemId: "20000000-0000-4000-8000-000000000002",
          name: "Bánh tráng trộn",
          unitPrice: 20000,
          quantity: 1,
        },
      ],
    }),
  ];

  return [
    ...pendingOrders,
    ...acceptedOrders,
    ...completedOrders,
    ...cancelledOrders,
  ];
}

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

function Item({ item }: { item: SellerOrder["order_items"][number] }) {
  return (
    <div className={styles.item}>
      {item.image_url ? (
        <Image
          src={item.image_url}
          alt={item.item_name_snapshot}
          width={52}
          height={52}
          unoptimized
          className={styles.thumb}
        />
      ) : (
        <FoodThumbnail
          kind={
            normalizeSearchText(item.item_name_snapshot).includes("tra")
              ? "drink"
              : "food"
          }
          className={styles.thumb}
        />
      )}
      <div>
        <strong>{item.item_name_snapshot}</strong>
        {item.selected_options.length > 0 && (
          <small>
            + {item.selected_options.map((o) => o.option_name).join(", ")}
          </small>
        )}
      </div>
      <span className={styles.quantity}>×{item.quantity}</span>
    </div>
  );
}

export default function SellerOrdersView() {
  const draft = useSellerPreview();

  // Desktop state (giữ nguyên 100%)
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [today, setToday] = useState("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<SellerOrderTab>("pending");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("today");
  const [sort, setSort] = useState("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ filter: "", page: 1 });
  const [notice, setNotice] = useState("");
  const bill = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  // Mobile state (khởi tạo đồng bộ với ảnh mẫu để SSR + Client khớp 100%)
  const [mobileOrders, setMobileOrders] = useState<SellerOrder[]>(() =>
    createSellerMobileOrderFixtures(),
  );
  const [mobileTab, setMobileTab] = useState<SellerOrderTab>("pending");
  const [mobileQuery, setMobileQuery] = useState("");
  const [mobilePeriod, setMobilePeriod] = useState("today");
  const [mobileSort, setMobileSort] = useState("newest");
  const [mobileSelectedId, setMobileSelectedId] = useState<string | null>(null);
  const [mobileNotice, setMobileNotice] = useState("");

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
  const filterKey = JSON.stringify([tab, query, period, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 3));
  const page = Math.min(
    pagination.filter === filterKey ? pagination.page : 1,
    pageCount,
  );
  const pageOrders = visible.slice((page - 1) * 3, page * 3);

  function goToPage(next: number) {
    setPagination({ filter: filterKey, page: next });
    setSelectedId(null);
  }

  useEffect(() => {
    if (selectedId)
      bill.current?.focus({
        preventScroll: window.matchMedia("(min-width: 1201px)").matches,
      });
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

  // Mobile filtering & status transitions
  const mobileBaseFiltered = filterSellerOrders(
    draft ? [] : mobileOrders,
    demoSellerRestaurant.id,
    mobileQuery,
    mobilePeriod === "today" ? SELLER_MOBILE_REFERENCE_DAY : null,
  );
  const mobileTabCounts = getSellerMobileTabCounts(mobileBaseFiltered);
  const mobileVisibleOrders = filterAndSortSellerMobileOrders(
    draft ? [] : mobileOrders,
    {
      restaurantId: demoSellerRestaurant.id,
      tab: mobileTab,
      query: mobileQuery,
      period: mobilePeriod,
      sort: mobileSort,
      day: SELLER_MOBILE_REFERENCE_DAY,
    },
  );
  const mobileSelectedOrder = selectedSellerOrder(
    mobileVisibleOrders,
    mobileSelectedId,
  );

  function changeMobileStatus(order: SellerOrder, status: OrderStatus) {
    if (
      status === "rejected" &&
      typeof window !== "undefined" &&
      typeof window.confirm === "function" &&
      !window.confirm(`Từ chối đơn #${order.order_code}? (Chỉ dữ liệu demo)`)
    ) {
      return;
    }
    const nowIso = new Date().toISOString();
    setMobileOrders((current) =>
      current.map((o) =>
        o.id === order.id ? transitionSellerOrder(o, status, nowIso) : o,
      ),
    );
    setMobileSelectedId(null);
    setMobileNotice(
      `Đơn #${order.order_code}: ${orderStatusLabels[status]}.`,
    );
  }

  return (
    <div className={styles.page}>
      <StudentHeader variant="seller" />
      <div
        className={styles.workspace}
        data-bill-open={selected ? "true" : "false"}
      >
        <SellerSidebar
          active="orders"
          name={draft?.name || demoSellerRestaurant.name}
          pendingOrderCount={mobileTabCounts.pending}
          menuLabel="Thực đơn"
        />

        {/* Phiên bản Desktop giữ nguyên 100% */}
        <div className={styles.desktopView}>
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
                    filtered.filter((o) =>
                      isInSellerTab(o.order_status, t.value),
                    ).length
                  }
                  )
                </button>
              ))}
            </div>
            {notice && (
              <p role="status" className={styles.notice}>
                {notice}
                <button
                  onClick={() => setNotice("")}
                  aria-label="Đóng thông báo"
                >
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
                  <p>
                    {tab === "pending"
                      ? "Các đơn mới cần bạn xác nhận."
                      : "Chọn một đơn để xem đầy đủ thông tin."}
                  </p>
                </div>
                <label className={styles.sort}>
                  <SlidersHorizontal size={17} />
                  <span>Sắp xếp:</span>
                  <select
                    aria-label="Sắp xếp đơn hàng"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setSelectedId(null);
                    }}
                  >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                  </select>
                </label>
              </div>
              <div className={styles.orderList}>
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
                          <span className={styles.address}>
                            <MapPin size={17} />
                            <span>
                              <strong>
                                {
                                  (
                                    order.delivery_address ?? "Chưa có địa chỉ"
                                  ).split(",")[0]
                                }
                              </strong>
                              {(order.delivery_address ?? "")
                                .split(",")
                                .slice(1)
                                .join(",")
                                .trim()}
                            </span>
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
                            <small className={styles.moreItems}>
                              <b>+{order.order_items.length - 2}</b> món khác
                            </small>
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
              </div>
              {pageCount > 1 && (
                <nav
                  className={styles.pagination}
                  aria-label="Phân trang đơn hàng"
                >
                  <span>
                    {visible.length} đơn · Trang {page}/{pageCount}
                  </span>
                  <div>
                    <button
                      disabled={page === 1}
                      onClick={() => goToPage(page - 1)}
                    >
                      Trước
                    </button>
                    <button
                      disabled={page === pageCount}
                      onClick={() => goToPage(page + 1)}
                    >
                      Sau
                    </button>
                  </div>
                </nav>
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
                {selected.payment_method === "bank_transfer" && (
                  <TransferContent
                    value={formatTransferContent(
                      selected.order_code,
                      draft?.name || demoSellerRestaurant.name,
                    )}
                  />
                )}
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
                  <div key={t.value} data-status={t.value}>
                    {t.value === "pending" ? (
                      <Clock3 />
                    ) : t.value === "cancelled" ? (
                      <XCircle />
                    ) : (
                      <CheckCircle2 />
                    )}
                    <span />
                  </div>
                ))}
              </div>
              <p>
                Nhấn mã đơn hoặc “Xem chi tiết” để mở bill. Chuyển tab để xem
                các đơn đã xử lý nhé!
              </p>
            </aside>
          )}
        </div>

        {/* Phiên bản Mobile trùng khớp 100% với ảnh mẫu */}
        <div className={styles.mobileView}>
          <header className={styles.mobileHeading}>
            <h1>Đơn hàng</h1>
            <p>Theo dõi và xử lý đơn của cửa hàng.</p>
          </header>

          <label className={styles.mobileSearch}>
            <Search size={18} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm mã đơn hoặc tên khách"
              placeholder="Tìm mã đơn hoặc tên khách"
              value={mobileQuery}
              onChange={(event) => {
                setMobileQuery(event.target.value);
                setMobileSelectedId(null);
              }}
            />
          </label>

          <div className={styles.mobileFilterRow}>
            <label className={styles.mobileFilterSelect}>
              <CalendarDays
                size={17}
                strokeWidth={2}
                className={styles.mobileFilterIcon}
                aria-hidden="true"
              />
              <select
                aria-label="Lọc đơn hàng theo ngày"
                value={mobilePeriod}
                onChange={(event) => {
                  setMobilePeriod(event.target.value);
                  setMobileSelectedId(null);
                }}
              >
                {sellerMobileDateFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                strokeWidth={2.2}
                className={styles.mobileFilterChevron}
                aria-hidden="true"
              />
            </label>

            <label className={styles.mobileFilterSelect}>
              <ArrowUpDown
                size={17}
                strokeWidth={2}
                className={styles.mobileFilterIcon}
                aria-hidden="true"
              />
              <select
                aria-label="Sắp xếp thứ tự đơn hàng"
                value={mobileSort}
                onChange={(event) => {
                  setMobileSort(event.target.value);
                  setMobileSelectedId(null);
                }}
              >
                {sellerMobileSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                strokeWidth={2.2}
                className={styles.mobileFilterChevron}
                aria-hidden="true"
              />
            </label>
          </div>

          <div
            className={styles.mobileTabs}
            role="tablist"
            aria-label="Phân loại nhanh trạng thái đơn hàng"
          >
            {sellerMobileOrderTabs.map((item) => {
              const isActive = mobileTab === item.value;
              const count = mobileTabCounts[item.value];
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-pressed={isActive}
                  className={`${styles.mobileTabButton} ${isActive ? styles.mobileTabActive : ""}`}
                  onClick={() => {
                    setMobileTab(item.value);
                    setMobileSelectedId(null);
                  }}
                >
                  <span>{item.label}</span>{" "}
                  <span className={styles.mobileTabCount}>{count}</span>
                </button>
              );
            })}
          </div>

          {mobileNotice && (
            <p role="status" className={styles.mobileNotice}>
              <span>{mobileNotice}</span>
              <button
                type="button"
                onClick={() => setMobileNotice("")}
                aria-label="Đóng thông báo"
              >
                <X size={15} />
              </button>
            </p>
          )}

          <div className={styles.mobileOrderCards}>
            {mobileVisibleOrders.length === 0 ? (
              <div className={styles.mobileEmpty}>
                <ClipboardList size={34} />
                <h3>Không có đơn hàng</h3>
                <p>Thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái khác.</p>
              </div>
            ) : (
              mobileVisibleOrders.slice(0, 3).map((order) => {
                const { area, detail } = splitMobileDeliveryAddress(
                  order.delivery_address,
                );
                const itemsSummary = formatMobileOrderItemsSummary(
                  order.order_items,
                );
                const noteBadge = getMobileOrderNoteBadge(order);
                const paymentLabel =
                  order.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản";

                return (
                  <article
                    key={order.id}
                    className={styles.mobileOrderCard}
                    data-order-code={order.order_code}
                  >
                    <div className={styles.mobileCardHeader}>
                      <div className={styles.mobileCardCodeWrap}>
                        <strong className={styles.mobileCardCode}>
                          #{order.order_code}
                        </strong>
                        <p className={styles.mobileCardSub}>
                          <span>{formatMobileOrderTime(order.created_at)}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{order.customer.name}</span>
                        </p>
                      </div>
                      <strong className={styles.mobileCardPrice}>
                        {formatMoney(order.total)}
                      </strong>
                    </div>

                    <div className={styles.mobileCardInfoList}>
                      <p className={styles.mobileCardAddress}>
                        <MapPin
                          size={15}
                          strokeWidth={2.2}
                          className={styles.mobileInfoIcon}
                          aria-hidden="true"
                        />
                        <span>
                          <strong>{area}</strong>
                          {detail ? ` · ${detail}` : ""}
                        </span>
                      </p>

                      <p className={styles.mobileCardDishes}>
                        <Utensils
                          size={15}
                          strokeWidth={2.2}
                          className={styles.mobileInfoIcon}
                          aria-hidden="true"
                        />
                        <strong>{itemsSummary}</strong>
                      </p>
                    </div>

                    <div className={styles.mobileCardMetaRow}>
                      <div className={styles.mobileMetaTags}>
                        {noteBadge && (
                          <>
                            <span className={styles.mobileMetaItem}>
                              <FileText
                                size={14}
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                              <span>{noteBadge}</span>
                            </span>
                            <span
                              className={styles.mobileMetaDot}
                              aria-hidden="true"
                            >
                              ·
                            </span>
                          </>
                        )}
                        <span className={styles.mobileMetaItem}>
                          <CreditCard
                            size={14}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                          <span>{paymentLabel}</span>
                        </span>
                      </div>

                      <button
                        type="button"
                        className={styles.mobileDetailLink}
                        onClick={() => setMobileSelectedId(order.id)}
                        aria-label={`Xem chi tiết đơn ${order.order_code}`}
                      >
                        <span>Xem chi tiết</span>
                        <ArrowRight
                          size={14}
                          strokeWidth={2.2}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    {order.order_status === "pending" && (
                      <div className={styles.mobileCardActions}>
                        <button
                          type="button"
                          className={styles.mobileRejectButton}
                          onClick={() => changeMobileStatus(order, "rejected")}
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          className={styles.mobileAcceptButton}
                          onClick={() => changeMobileStatus(order, "accepted")}
                        >
                          Chấp nhận
                        </button>
                      </div>
                    )}

                    {order.order_status === "accepted" && (
                      <div className={styles.mobileCardActionsSingle}>
                        <button
                          type="button"
                          className={styles.mobileAcceptButton}
                          onClick={() => changeMobileStatus(order, "completed")}
                        >
                          Hoàn thành
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          {mobileSelectedOrder && (
            <section
              className={styles.mobileDetailSheet}
              aria-label={`Chi tiết đơn hàng ${mobileSelectedOrder.order_code}`}
            >
              <div className={styles.mobileDetailHeader}>
                <div>
                  <strong>#{mobileSelectedOrder.order_code}</strong>
                  <small>
                    {formatMobileOrderTime(mobileSelectedOrder.created_at)} ·{" "}
                    {mobileSelectedOrder.customer.name}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSelectedId(null)}
                  aria-label="Đóng chi tiết đơn hàng"
                >
                  <X size={18} />
                </button>
              </div>
              <p className={styles.mobileDetailLine}>
                <MapPin size={15} />
                <span>{mobileSelectedOrder.delivery_address}</span>
              </p>
              <div className={styles.mobileDetailItems}>
                {mobileSelectedOrder.order_items.map((item) => (
                  <div key={item.id} className={styles.mobileDetailItem}>
                    <span>
                      {item.quantity}× {item.item_name_snapshot}
                    </span>
                    <strong>
                      {formatMoney(item.unit_price_snapshot * item.quantity)}
                    </strong>
                  </div>
                ))}
              </div>
              {mobileSelectedOrder.customer_notes && (
                <p className={styles.mobileDetailNote}>
                  Ghi chú: {mobileSelectedOrder.customer_notes}
                </p>
              )}
              <div className={styles.mobileDetailTotal}>
                <span>Tổng thanh toán</span>
                <strong>{formatMoney(mobileSelectedOrder.total)}</strong>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
