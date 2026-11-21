"use client";

import Link from "next/link";
import { useState, type SVGProps } from "react";
import {
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  FileText,
  List,
  MapPin,
  Package,
  Phone,
  QrCode,
  ShieldCheck,
  Store,
  User,
  Utensils,
  X,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import styles from "@/styles/delivery.module.css";

export type DeliveryOrder = {
  id: string;
  orderCode: string;
  badgeState: "new" | "waiting" | "done";
  time: string;
  customerName: string;
  phone: string;
  dorm: "KTX A" | "KTX B";
  addressDetail: string;
  itemCount: number;
  paymentMethod: "cash" | "transfer";
  total: number;
  items: string[];
  status: "delivering" | "delivered";
};

export type DeliveryDormFilter = "all" | "KTX A" | "KTX B";

export const deliveryDormFilterOptions: readonly {
  value: DeliveryDormFilter;
  label: string;
}[] = [
  { value: "all", label: "Tất cả" },
  { value: "KTX A", label: "KTX A" },
  { value: "KTX B", label: "KTX B" },
] as const;

export const initialMockDeliveryOrders: DeliveryOrder[] = [
  {
    id: "1",
    orderCode: "#SF0128",
    badgeState: "new",
    time: "10:24",
    customerName: "Nguyễn Minh Anh",
    phone: "0321 456 789",
    dorm: "KTX A",
    addressDetail: "Cổng B, Phòng 302",
    itemCount: 2,
    paymentMethod: "cash",
    total: 56000,
    items: ["Cơm sườn nướng x1", "Trà tắc x1"],
    status: "delivering",
  },
  {
    id: "2",
    orderCode: "#SF0129",
    badgeState: "new",
    time: "11:05",
    customerName: "Trần Thị Bảo Ngọc",
    phone: "0909 876 543",
    dorm: "KTX B",
    addressDetail: "Tòa B1, Phòng 101",
    itemCount: 3,
    paymentMethod: "transfer",
    total: 72000,
    items: [
      "Cơm gà xối mỡ x1",
      "Canh rong biển x1",
      "Trà sữa truyền thống x1",
    ],
    status: "delivering",
  },
  {
    id: "3",
    orderCode: "#SF0130",
    badgeState: "waiting",
    time: "11:32",
    customerName: "Lê Hoàng Nam",
    phone: "0789 321 654",
    dorm: "KTX A",
    addressDetail: "Tòa A2, Phòng 205",
    itemCount: 2,
    paymentMethod: "cash",
    total: 48000,
    items: ["Bánh tráng trộn x1", "Trà đào x1"],
    status: "delivering",
  },
  {
    id: "4",
    orderCode: "#SF0131",
    badgeState: "waiting",
    time: "11:45",
    customerName: "Phạm Quốc Bảo",
    phone: "0912 345 678",
    dorm: "KTX B",
    addressDetail: "Tòa B3, Phòng 410",
    itemCount: 2,
    paymentMethod: "cash",
    total: 65000,
    items: ["Cơm tấm sườn bì chả x1", "Trà chanh x1"],
    status: "delivering",
  },
  {
    id: "5",
    orderCode: "#SF0120",
    badgeState: "done",
    time: "09:15",
    customerName: "Võ Hoàng Yến",
    phone: "0934 567 890",
    dorm: "KTX A",
    addressDetail: "Tòa A1, Sảnh chính",
    itemCount: 1,
    paymentMethod: "transfer",
    total: 35000,
    items: ["Cơm gà chiên nước mắm x1"],
    status: "delivered",
  },
  {
    id: "6",
    orderCode: "#SF0121",
    badgeState: "done",
    time: "09:40",
    customerName: "Đặng Tuấn Kiệt",
    phone: "0978 123 456",
    dorm: "KTX B",
    addressDetail: "Tòa B2, Phòng 108",
    itemCount: 2,
    paymentMethod: "cash",
    total: 52000,
    items: ["Cơm sườn trứng x1", "Trà đào cam sả x1"],
    status: "delivered",
  },
];

export function shouldShowDeliveryQrButton(
  orderOrMethod:
    | Pick<DeliveryOrder, "paymentMethod">
    | DeliveryOrder["paymentMethod"],
): boolean {
  const method =
    typeof orderOrMethod === "string"
      ? orderOrMethod
      : orderOrMethod.paymentMethod;
  return method === "transfer";
}

export function getDeliveryOrderCounts(
  orders: readonly DeliveryOrder[],
  initialCompletedBaseCount = 10,
): {
  deliveringCount: number;
  deliveredCount: number;
} {
  const deliveringCount = orders.filter(
    (order) => order.status === "delivering",
  ).length;
  const deliveredCount =
    initialCompletedBaseCount +
    orders.filter((order) => order.status === "delivered").length;
  return { deliveringCount, deliveredCount };
}

export function filterDeliveryOrders(
  orders: readonly DeliveryOrder[],
  options: {
    status: "delivering" | "delivered";
    dorm: DeliveryDormFilter;
  },
): DeliveryOrder[] {
  return orders.filter((order) => {
    if (order.status !== options.status) return false;
    if (options.dorm !== "all" && order.dorm !== options.dorm) return false;
    return true;
  });
}

export function getDeliveryBadgeLabel(
  badgeState: DeliveryOrder["badgeState"],
): string {
  if (badgeState === "new") return "Mới";
  if (badgeState === "waiting") return "Đang chờ";
  return "Đã giao";
}

export function DeliveryScooterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M14.8438 7.03125H17.1875C17.6019 7.03125 17.9993 7.19587 18.2924 7.4889C18.5854 7.78192 18.75 8.17935 18.75 8.59375V15.7891C16.9414 16.3078 15.625 17.9938 15.625 19.9539C15.625 20.457 15.9563 20.8961 16.4219 21.0422L16.4281 21.0938H9.63125C10.1967 20.6368 10.6066 20.0158 10.8044 19.3163C11.0023 18.6168 10.9785 17.8731 10.7362 17.1877C10.4939 16.5022 10.045 15.9088 9.45149 15.489C8.85794 15.0693 8.14886 14.8438 7.42188 14.8438H4.22969C3.84297 14.8438 3.47188 14.907 3.125 15.0242V14.8438C3.125 14.2221 3.37193 13.626 3.81147 13.1865C4.25101 12.7469 4.84715 12.5 5.46875 12.5H13.6719C13.7755 12.5 13.8748 12.5412 13.9481 12.6144C14.0213 12.6877 14.0625 12.787 14.0625 12.8906V14.0625C14.0625 14.4769 13.8979 14.8743 13.6049 15.1674C13.3118 15.4604 12.9144 15.625 12.5 15.625H12.1094C11.7986 15.625 11.5005 15.7485 11.2807 15.9682C11.061 16.188 10.9375 16.4861 10.9375 16.7969C10.9375 17.1077 11.061 17.4057 11.2807 17.6255C11.5005 17.8453 11.7986 17.9688 12.1094 17.9688H15.1039C15.2421 17.9688 15.3747 17.9138 15.4724 17.8161C15.5701 17.7184 15.625 17.5859 15.625 17.4477V8.59375H14.8438C14.6365 8.59375 14.4378 8.51144 14.2913 8.36493C14.1448 8.21841 14.0625 8.0197 14.0625 7.8125C14.0625 7.6053 14.1448 7.40659 14.2913 7.26007C14.4378 7.11356 14.6365 7.03125 14.8438 7.03125Z"
        fill="#F24822"
      />
      <path
        d="M12.7602 10.1562C13.4789 10.1562 14.0625 10.7391 14.0625 11.4586C14.0625 11.6023 13.9453 11.7188 13.8023 11.7188H7.29141C7.14766 11.7188 7.03125 11.6016 7.03125 11.4586C7.03125 10.7398 7.61406 10.1562 8.33359 10.1562H12.7602ZM17.1875 20.7031C17.1882 21.0783 17.266 21.4493 17.4163 21.7931C17.5665 22.1369 17.7858 22.446 18.0607 22.7014C18.3355 22.9568 18.66 23.1528 19.0139 23.2774C19.3677 23.402 19.7435 23.4524 20.1177 23.4256C20.4919 23.3987 20.8565 23.2951 21.189 23.1213C21.5214 22.9474 21.8146 22.707 22.0501 22.415C22.2857 22.123 22.4586 21.7857 22.5582 21.424C22.6577 21.0622 22.6818 20.6839 22.6289 20.3125H23.082C23.1765 20.3115 23.2668 20.2733 23.3334 20.2061C23.3999 20.139 23.4373 20.0484 23.4375 19.9539C23.4375 18.0125 21.8633 16.4062 19.9219 16.4062C17.9805 16.4062 16.4062 18.0125 16.4062 19.9539C16.4064 20.0483 16.4438 20.1388 16.5101 20.2059C16.5765 20.273 16.6666 20.3113 16.7609 20.3125H17.2148C17.1966 20.4401 17.1875 20.5703 17.1875 20.7031ZM21.0273 20.3125C21.0895 20.4892 21.1084 20.6782 21.0824 20.8638C21.0565 21.0493 20.9864 21.2259 20.8782 21.3787C20.7699 21.5316 20.6266 21.6563 20.4602 21.7423C20.2938 21.8284 20.1092 21.8733 19.9219 21.8733C19.7346 21.8733 19.55 21.8284 19.3836 21.7423C19.2172 21.6563 19.0738 21.5316 18.9656 21.3787C18.8573 21.2259 18.7873 21.0493 18.7613 20.8638C18.7353 20.6782 18.7542 20.4892 18.8164 20.3125H21.0273ZM2.37109 21.0938C2.46566 21.7465 2.79292 22.3431 3.29258 22.7736C3.79225 23.2042 4.43066 23.4397 5.09022 23.4367C5.74977 23.4338 6.38605 23.1926 6.88185 22.7576C7.37764 22.3226 7.69955 21.7231 7.78828 21.0695C8.47612 20.9774 9.10319 20.6271 9.54237 20.0898C9.98154 19.5524 10.2 18.8682 10.1534 18.1758C10.1068 17.4833 9.79864 16.8346 9.29142 16.3609C8.7842 15.8872 8.11586 15.6242 7.42188 15.625H4.22969C3.5223 15.625 2.84389 15.906 2.3437 16.4062C1.84351 16.9064 1.5625 17.5848 1.5625 18.2922V20.3125C1.5625 20.5197 1.64481 20.7184 1.79132 20.8649C1.93784 21.0114 2.13655 21.0938 2.34375 21.0938H2.37109ZM6.18359 21.0938C6.10307 21.3227 5.95348 21.5209 5.75546 21.6612C5.55745 21.8014 5.32078 21.8767 5.07812 21.8767C4.83547 21.8767 4.5988 21.8014 4.40079 21.6612C4.20277 21.5209 4.05318 21.3227 3.97266 21.0938H6.18359Z"
        fill="#F24822"
      />
    </svg>
  );
}

function RoadBannerGraphic() {
  return (
    <svg
      className={styles.bannerRoadSvg}
      viewBox="0 0 90 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 58C24 46 30 34 26 24C22 14 44 10 74 6"
        stroke="#F6E3D4"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M8 58C24 46 30 34 26 24C22 14 44 10 74 6"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      <path
        d="M44 10C40.134 10 37 13.134 37 17C37 22.25 44 29 44 29C44 29 51 22.25 51 17C51 13.134 47.866 10 44 10Z"
        fill="#EF4444"
      />
      <circle cx="44" cy="17" r="2.5" fill="#FFFFFF" />
    </svg>
  );
}

function DeliveryOrderCardItem({
  order,
  testIdPrefix,
  onMarkDelivered,
  onOpenDetail,
  onOpenQr,
}: {
  order: DeliveryOrder;
  testIdPrefix: string;
  onMarkDelivered: (orderId: string, orderCode: string) => void;
  onOpenDetail: (order: DeliveryOrder) => void;
  onOpenQr: (order: DeliveryOrder) => void;
}) {
  const badgeLabel = getDeliveryBadgeLabel(order.badgeState);
  const badgeClass =
    order.badgeState === "new"
      ? styles.stateNew
      : order.badgeState === "waiting"
        ? styles.stateWaiting
        : styles.stateDone;
  const showQrButton = shouldShowDeliveryQrButton(order);

  return (
    <article
      className={styles.orderCard}
      data-testid={`${testIdPrefix}-${order.orderCode.replace("#", "")}`}
      data-payment-method={order.paymentMethod}
    >
      <div className={styles.orderHeader}>
        <div className={styles.orderCodeWrap}>
          <strong className={styles.orderCode}>{order.orderCode}</strong>
          <span className={`${styles.stateBadge} ${badgeClass}`}>
            {badgeLabel}
          </span>
        </div>
        <span className={styles.orderTime}>{order.time}</span>
      </div>

      <div className={styles.orderBody}>
        <div className={styles.customerInfo}>
          <div className={styles.infoRow}>
            <User
              size={16}
              className={styles.infoIcon}
              aria-hidden="true"
            />
            <span className={styles.customerName}>{order.customerName}</span>
          </div>

          <div className={styles.infoRow}>
            <Phone
              size={15}
              className={styles.infoIcon}
              aria-hidden="true"
            />
            <span className={styles.customerPhone}>{order.phone}</span>
          </div>

          <div className={styles.infoRow}>
            <MapPin
              size={16}
              className={styles.pinIcon}
              aria-hidden="true"
            />
            <span className={styles.dormBadge}>{order.dorm}</span>
            <span className={styles.addressDetail}>{order.addressDetail}</span>
          </div>
        </div>

        <div className={styles.orderMeta}>
          <span className={styles.itemCount}>
            <Package size={16} aria-hidden="true" />
            {order.itemCount} món
          </span>

          <span
            className={`${styles.paymentBadge} ${
              order.paymentMethod === "cash"
                ? styles.paymentCash
                : styles.paymentTransfer
            }`}
          >
            {order.paymentMethod === "cash" ? (
              <>
                <Banknote size={14} aria-hidden="true" />
                Tiền mặt
              </>
            ) : (
              <>
                <CreditCard size={14} aria-hidden="true" />
                Chuyển khoản
              </>
            )}
          </span>

          <strong className={styles.orderTotal}>
            {formatMoney(order.total)}
          </strong>
        </div>
      </div>

      <div className={styles.itemsSummary}>
        <List size={15} aria-hidden="true" />
        <span className={styles.itemsText}>{order.items.join("  •  ")}</span>
      </div>

      {/* Hàng nút 1: Gọi khách | Xem chi tiết */}
      <div className={styles.actionsGrid}>
        <a
          href={`tel:${order.phone.replace(/\s+/g, "")}`}
          className={styles.callBtn}
        >
          <Phone size={15} aria-hidden="true" />
          <span>Gọi khách</span>
        </a>

        <button
          type="button"
          className={styles.detailBtn}
          onClick={() => onOpenDetail(order)}
        >
          <FileText size={15} aria-hidden="true" />
          <span>Xem chi tiết</span>
        </button>
      </div>

      {/* Hàng nút 2: Nếu Chuyển khoản -> Mã QR | Đánh dấu đã giao (cùng kích thước Gọi khách / Xem chi tiết); Nếu Tiền mặt -> chỉ hiển thị Đánh dấu đã giao full width */}
      <div
        className={
          showQrButton
            ? styles.secondaryActionsGrid
            : styles.secondaryActionsSingle
        }
        data-has-qr={showQrButton ? "true" : "false"}
      >
        {showQrButton && (
          <button
            type="button"
            className={styles.qrBtn}
            onClick={() => onOpenQr(order)}
          >
            <QrCode size={15} aria-hidden="true" />
            <span>Mã QR</span>
          </button>
        )}

        {order.status === "delivering" ? (
          <button
            type="button"
            className={styles.completeBtn}
            onClick={() => onMarkDelivered(order.id, order.orderCode)}
          >
            <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>Đánh dấu đã giao</span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            className={`${styles.completeBtn} ${styles.completeBtnDone}`}
          >
            <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>Đã giao thành công</span>
          </button>
        )}
      </div>
    </article>
  );
}

export default function DeliveryDashboard({
  shopName = "Cơm Cô Ba",
  initialOrders = initialMockDeliveryOrders,
  initialCompletedBaseCount = 10,
}: {
  shopName?: string;
  initialOrders?: DeliveryOrder[];
  initialCompletedBaseCount?: number;
}) {
  const [orders, setOrders] = useState<DeliveryOrder[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<"delivering" | "delivered">(
    "delivering",
  );
  const [dormFilter, setDormFilter] = useState<DeliveryDormFilter>("all");
  const [toast, setToast] = useState("");
  const [qrOrder, setQrOrder] = useState<DeliveryOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<DeliveryOrder | null>(null);

  const { deliveringCount, deliveredCount } = getDeliveryOrderCounts(
    orders,
    initialCompletedBaseCount,
  );

  const deliveringOrders = orders.filter(
    (order) => order.status === "delivering",
  );
  const ktxADeliveringCount = deliveringOrders.filter(
    (order) => order.dorm === "KTX A",
  ).length;
  const ktxBDeliveringCount = deliveringOrders.filter(
    (order) => order.dorm === "KTX B",
  ).length;
  const transferDeliveringCount = deliveringOrders.filter((order) =>
    shouldShowDeliveryQrButton(order),
  ).length;
  const cashDeliveringCount = deliveringOrders.length - transferDeliveringCount;

  const visibleOrders = filterDeliveryOrders(orders, {
    status: activeTab,
    dorm: dormFilter,
  });

  function handleMarkDelivered(orderId: string, orderCode: string) {
    setOrders((current) =>
      current.map((entry) =>
        entry.id === orderId
          ? { ...entry, status: "delivered", badgeState: "done" }
          : entry,
      ),
    );
    setToast(`Đã đánh dấu hoàn thành giao đơn ${orderCode}.`);
  }

  return (
    <div className={styles.page} data-testid="seller-delivery-page">
      {/* =====================================================================
          PHIÊN BẢN DESKTOP (> 760px) — Tuân thủ quy tắc hệ thống (/seller & /seller/shop)
         ===================================================================== */}
      <div className={styles.desktopView} data-testid="seller-delivery-desktop">
        <header className={styles.desktopTopHeader}>
          <div className={styles.desktopTopHeaderInner}>
            <Link
              href="/"
              className={styles.desktopBrand}
              aria-label="StudentFood - Quyền giao hàng"
            >
              <span className={styles.desktopBrandIcon}>
                <Utensils size={28} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className={styles.desktopBrandCopy}>
                <strong>
                  Student<span>Food</span>
                </strong>
                <small>Món ngon, gần bạn hơn</small>
              </span>
            </Link>

            <nav
              className={styles.desktopTopNav}
              aria-label="Điều hướng Seller"
            >
              <Link href="/seller">Tổng quan</Link>
              <Link href="/seller/orders">Đơn hàng</Link>
              <Link href="/seller/menu">Thực đơn</Link>
              <Link href="/seller/shop">Cửa hàng</Link>
              <span className={styles.desktopTopNavCurrent} aria-current="page">
                Đơn cần giao
              </span>
            </nav>

            <div className={styles.desktopTopActions}>
              <span className={styles.desktopPermissionPill}>
                <ShieldCheck size={16} aria-hidden="true" />
                Quyền giao hàng
              </span>
              <button
                type="button"
                className={styles.shopPill}
                aria-label={`Cửa hàng: ${shopName}`}
              >
                <span className={styles.shopAvatar} aria-hidden="true">
                  🍲
                </span>
                <span>{shopName}</span>
                <ChevronDown
                  size={15}
                  className={styles.shopChevron}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </header>

        <div className={styles.desktopWorkspace}>
          {/* Sidebar trái chuẩn hệ thống Seller (/seller, /seller/shop) */}
          <aside
            className={styles.desktopSidebar}
            aria-label="Bảng điều hướng giao hàng cửa hàng"
          >
            <div className={styles.desktopSidebarShop}>
              <div className={styles.desktopSidebarAvatar} aria-hidden="true">
                🍲
              </div>
              <div className={styles.desktopSidebarShopText}>
                <strong>{shopName}</strong>
                <span>Quyền giao hàng</span>
              </div>
            </div>

            <div className={styles.desktopSidebarSection}>
              <small className={styles.desktopSidebarLabel}>
                TRẠNG THÁI ĐƠN GIAO
              </small>
              <button
                type="button"
                className={styles.desktopSidebarNavBtn}
                data-active={activeTab === "delivering"}
                onClick={() => setActiveTab("delivering")}
              >
                <DeliveryScooterIcon />
                <span>Đơn cần giao</span>
                <strong className={styles.desktopSidebarCount}>
                  {deliveringCount}
                </strong>
              </button>
              <button
                type="button"
                className={styles.desktopSidebarNavBtn}
                data-active={activeTab === "delivered"}
                onClick={() => setActiveTab("delivered")}
              >
                <CheckCircle2 size={20} aria-hidden="true" />
                <span>Đơn đã giao</span>
                <strong className={styles.desktopSidebarCountMuted}>
                  {deliveredCount}
                </strong>
              </button>
            </div>

            <div className={styles.desktopSidebarSection}>
              <small className={styles.desktopSidebarLabel}>
                KHU VỰC KÝ TÚC XÁ
              </small>
              {deliveryDormFilterOptions.map((chip) => (
                <button
                  key={`desktop-sidebar-${chip.value}`}
                  type="button"
                  className={styles.desktopSidebarDormBtn}
                  data-active={dormFilter === chip.value}
                  onClick={() => setDormFilter(chip.value)}
                >
                  <MapPin size={16} aria-hidden="true" />
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>

            <Link href="/seller/shop" className={styles.desktopSidebarBack}>
              <ArrowLeft size={17} aria-hidden="true" />
              Quay lại Cửa hàng
            </Link>
          </aside>

          {/* Vùng nội dung chính Desktop */}
          <main className={styles.desktopMain}>
            <div className={styles.desktopHeading}>
              <div>
                <h1>Đơn cần giao</h1>
                <p>
                  Xem các đơn đang chờ giao của cửa hàng và cập nhật tiến độ
                  giao hàng cho sinh viên.
                </p>
              </div>
              <div className={styles.desktopHeadingActions}>
                <span className={styles.desktopStatusBadge}>
                  ● Đang điều phối ({deliveringCount} đơn chờ giao)
                </span>
                <Link href="/seller/shop" className={styles.desktopNeutralBtn}>
                  <Store size={17} aria-hidden="true" />
                  Quản lý cửa hàng
                </Link>
              </div>
            </div>

            {/* 3 Thẻ thống kê nhanh chuẩn giao diện Seller Desktop */}
            <section
              className={styles.desktopStatsRow}
              aria-label="Thống kê nhanh đơn giao hôm nay"
            >
              <article className={styles.desktopStatCard}>
                <div className={styles.desktopStatIconOrange}>
                  <DeliveryScooterIcon />
                </div>
                <div>
                  <span className={styles.desktopStatLabel}>
                    Hôm nay cần giao
                  </span>
                  <strong className={styles.desktopStatValue}>
                    {deliveringCount} đơn cần giao
                  </strong>
                  <small className={styles.desktopStatSub}>
                    Cố gắng giao đúng giờ nhé!
                  </small>
                </div>
              </article>

              <article className={styles.desktopStatCard}>
                <div className={styles.desktopStatIconGreen}>
                  <CheckCircle2 size={24} aria-hidden="true" />
                </div>
                <div>
                  <span className={styles.desktopStatLabel}>
                    Đã giao hoàn tất
                  </span>
                  <strong className={styles.desktopStatValue}>
                    {deliveredCount} đơn đã giao
                  </strong>
                  <small className={styles.desktopStatSub}>
                    Hoàn thành trong ca hôm nay
                  </small>
                </div>
              </article>

              <article className={styles.desktopStatCard}>
                <div className={styles.desktopStatIconBlue}>
                  <MapPin size={24} aria-hidden="true" />
                </div>
                <div>
                  <span className={styles.desktopStatLabel}>
                    Phân bổ khu vực
                  </span>
                  <strong className={styles.desktopStatValue}>
                    KTX A ({ktxADeliveringCount}) • KTX B ({ktxBDeliveringCount}
                    )
                  </strong>
                  <small className={styles.desktopStatSub}>
                    Tiền mặt: {cashDeliveringCount} • Chuyển khoản:{" "}
                    {transferDeliveringCount}
                  </small>
                </div>
              </article>
            </section>

            {toast && (
              <div role="status" className={styles.toast}>
                <span>{toast}</span>
                <button
                  type="button"
                  onClick={() => setToast("")}
                  aria-label="Đóng thông báo"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className={styles.desktopContentColumns}>
              <div className={styles.desktopOrdersColumn}>
                {/* Thanh công cụ lọc Tab + Khu KTX trên Desktop */}
                <div className={styles.desktopFilterBar}>
                  <div
                    className={styles.desktopStatusTabs}
                    role="tablist"
                    aria-label="Trạng thái giao hàng trên máy tính"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "delivering"}
                      className={`${styles.statusTab} ${
                        activeTab === "delivering" ? styles.statusTabActive : ""
                      }`}
                      onClick={() => setActiveTab("delivering")}
                    >
                      Cần giao ({deliveringCount})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "delivered"}
                      className={`${styles.statusTab} ${
                        activeTab === "delivered" ? styles.statusTabActive : ""
                      }`}
                      onClick={() => setActiveTab("delivered")}
                    >
                      Đã giao ({deliveredCount})
                    </button>
                  </div>

                  <div
                    className={styles.desktopDormChips}
                    role="group"
                    aria-label="Lọc theo khu KTX trên máy tính"
                  >
                    {deliveryDormFilterOptions.map((chip) => (
                      <button
                        key={`desktop-chip-${chip.value}`}
                        type="button"
                        aria-pressed={dormFilter === chip.value}
                        className={`${styles.locationChip} ${
                          dormFilter === chip.value
                            ? styles.locationChipActive
                            : ""
                        }`}
                        onClick={() => setDormFilter(chip.value)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {visibleOrders.length > 0 ? (
                  <div className={styles.desktopOrdersGrid}>
                    {visibleOrders.map((order) => (
                      <DeliveryOrderCardItem
                        key={`desktop-${order.id}`}
                        order={order}
                        testIdPrefix="desktop-delivery-order-card"
                        onMarkDelivered={handleMarkDelivered}
                        onOpenDetail={setDetailOrder}
                        onOpenQr={setQrOrder}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>
                    <strong>Không có đơn hàng nào</strong>
                    <p>
                      {activeTab === "delivering"
                        ? "Tất cả đơn trong khu vực này đã được giao xong."
                        : "Chưa có đơn hàng đã giao trong khu vực này."}
                    </p>
                  </div>
                )}
              </div>

              {/* Cột phải Desktop: Banner tóm tắt & Hướng dẫn thao tác */}
              <aside className={styles.desktopRightRail}>
                <section
                  className={styles.banner}
                  aria-label="Tóm tắt lộ trình giao hàng"
                >
                  <div className={styles.bannerIconBox}>
                    <DeliveryScooterIcon />
                  </div>
                  <div className={styles.bannerCopy}>
                    <span>Hôm nay</span>
                    <strong>{deliveringCount} đơn cần giao</strong>
                    <small>Cố gắng giao đúng giờ nhé!</small>
                  </div>
                  <div className={styles.bannerArt}>
                    <RoadBannerGraphic />
                    <div className={styles.bannerSlogan}>
                      Sinh viên
                      <br />
                      ngon hơn
                      <br />
                      mỗi ngày !
                    </div>
                  </div>
                </section>

                <section className={styles.desktopGuideCard}>
                  <h3>
                    <Clock3 size={18} aria-hidden="true" />
                    Quy trình giao đơn
                  </h3>
                  <ol className={styles.desktopGuideList}>
                    <li>
                      Kiểm tra khu <strong>KTX A / KTX B</strong> và tòa, phòng
                      trước khi xuất phát.
                    </li>
                    <li>
                      Bấm <strong>Gọi khách</strong> khi tới điểm hẹn. Với đơn{" "}
                      <strong>Chuyển khoản</strong>, mở <strong>Mã QR</strong>{" "}
                      để khách quét nhanh.
                    </li>
                    <li>
                      Sau khi bàn giao món, bấm{" "}
                      <strong>Đánh dấu đã giao</strong> để hoàn tất đơn.
                    </li>
                  </ol>
                </section>
              </aside>
            </div>
          </main>
        </div>
      </div>

      {/* =====================================================================
          PHIÊN BẢN MOBILE (<= 760px) — Khớp 100% ảnh mẫu, chỉ bật trên thiết bị Mobile
         ===================================================================== */}
      <div className={styles.mobileView} data-testid="seller-delivery-mobile">
        {/* Top Header */}
        <header className={styles.header}>
          <div className={`${styles.shell} ${styles.headerInner}`}>
            <Link
              href="/"
              className={styles.brand}
              aria-label="StudentFood - Quyền giao hàng"
            >
              <span className={styles.brandIcon}>
                <Utensils size={23} strokeWidth={2.1} aria-hidden="true" />
              </span>
              <span className={styles.brandText}>
                <strong>
                  Student<span>Food</span>
                </strong>
                <small>Quyền giao hàng</small>
              </span>
            </Link>

            <button
              type="button"
              className={styles.shopPill}
              aria-label={`Cửa hàng: ${shopName}`}
            >
              <span className={styles.shopAvatar} aria-hidden="true">
                🍲
              </span>
              <span>{shopName}</span>
              <ChevronDown
                size={15}
                className={styles.shopChevron}
                aria-hidden="true"
              />
            </button>
          </div>
        </header>

        <main className={`${styles.shell} ${styles.main}`}>
          <div className={styles.heading}>
            <h1>Đơn cần giao</h1>
            <p>Xem các đơn đang chờ giao của cửa hàng.</p>
          </div>

          {/* 2 Tab Cần giao / Đã giao */}
          <div
            className={styles.statusTabs}
            role="tablist"
            aria-label="Trạng thái giao hàng"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "delivering"}
              className={`${styles.statusTab} ${
                activeTab === "delivering" ? styles.statusTabActive : ""
              }`}
              onClick={() => setActiveTab("delivering")}
            >
              Cần giao ({deliveringCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "delivered"}
              className={`${styles.statusTab} ${
                activeTab === "delivered" ? styles.statusTabActive : ""
              }`}
              onClick={() => setActiveTab("delivered")}
            >
              Đã giao ({deliveredCount})
            </button>
          </div>

          {/* Bộ lọc khu vực KTX */}
          <div
            className={styles.locationFilters}
            role="group"
            aria-label="Lọc theo khu KTX"
          >
            {deliveryDormFilterOptions.map((chip) => (
              <button
                key={chip.value}
                type="button"
                aria-pressed={dormFilter === chip.value}
                className={`${styles.locationChip} ${
                  dormFilter === chip.value ? styles.locationChipActive : ""
                }`}
                onClick={() => setDormFilter(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Banner tóm tắt */}
          <section
            className={styles.banner}
            aria-label="Tóm tắt đơn giao hôm nay"
          >
            <div
              className={styles.bannerIconBox}
              data-testid="delivery-scooter-box"
            >
              <DeliveryScooterIcon />
            </div>
            <div className={styles.bannerCopy}>
              <span>Hôm nay</span>
              <strong>{deliveringCount} đơn cần giao</strong>
              <small>Cố gắng giao đúng giờ nhé!</small>
            </div>
            <div className={styles.bannerArt}>
              <RoadBannerGraphic />
              <div className={styles.bannerSlogan}>
                Sinh viên
                <br />
                ngon hơn
                <br />
                mỗi ngày !
              </div>
            </div>
          </section>

          {toast && (
            <div role="status" className={styles.toast}>
              <span>{toast}</span>
              <button
                type="button"
                onClick={() => setToast("")}
                aria-label="Đóng thông báo"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Danh sách Card đơn hàng Mobile */}
          {visibleOrders.length > 0 ? (
            <div className={styles.orderList}>
              {visibleOrders.map((order) => (
                <DeliveryOrderCardItem
                  key={order.id}
                  order={order}
                  testIdPrefix="delivery-order-card"
                  onMarkDelivered={handleMarkDelivered}
                  onOpenDetail={setDetailOrder}
                  onOpenQr={setQrOrder}
                />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <strong>Không có đơn hàng nào</strong>
              <p>
                {activeTab === "delivering"
                  ? "Tất cả đơn trong khu vực này đã được giao xong."
                  : "Chưa có đơn hàng đã giao trong khu vực này."}
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Popup xem chi tiết đơn hàng */}
      {detailOrder && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-detail-title"
          onClick={() => setDetailOrder(null)}
        >
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 id="delivery-detail-title">
                Chi tiết đơn {detailOrder.orderCode}
              </h3>
              <button
                type="button"
                onClick={() => setDetailOrder(null)}
                aria-label="Đóng chi tiết đơn"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.detailModalBody}>
              <div className={styles.detailModalRow}>
                <span>Khách hàng</span>
                <strong>{detailOrder.customerName}</strong>
              </div>
              <div className={styles.detailModalRow}>
                <span>Số điện thoại</span>
                <strong>{detailOrder.phone}</strong>
              </div>
              <div className={styles.detailModalRow}>
                <span>Địa chỉ giao</span>
                <strong>
                  {detailOrder.dorm} • {detailOrder.addressDetail}
                </strong>
              </div>
              <div className={styles.detailModalRow}>
                <span>Thanh toán</span>
                <strong>
                  {detailOrder.paymentMethod === "transfer"
                    ? "Chuyển khoản"
                    : "Tiền mặt"}
                </strong>
              </div>
              <div className={styles.detailModalItems}>
                <span>Danh sách món ({detailOrder.itemCount} món)</span>
                <ul>
                  {detailOrder.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.detailModalTotal}>
                <span>Tổng tiền</span>
                <strong>{formatMoney(detailOrder.total)}</strong>
              </div>
            </div>

            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setDetailOrder(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Popup hiển thị mã QR của đơn hàng */}
      {qrOrder && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-qr-title"
          onClick={() => setQrOrder(null)}
        >
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 id="delivery-qr-title">Mã QR đơn {qrOrder.orderCode}</h3>
              <button
                type="button"
                onClick={() => setQrOrder(null)}
                aria-label="Đóng mã QR"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.qrBox}>
              <QrCode size={112} strokeWidth={1.5} />
            </div>

            <strong>{qrOrder.customerName}</strong>
            <p className={styles.modalSub}>
              {qrOrder.dorm} • {qrOrder.addressDetail} •{" "}
              {formatMoney(qrOrder.total)}
            </p>

            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setQrOrder(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
