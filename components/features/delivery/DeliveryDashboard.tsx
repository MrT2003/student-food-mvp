"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Banknote,
  Check,
  ChevronDown,
  CreditCard,
  List,
  MapPin,
  Package,
  Phone,
  QrCode,
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

function ScooterIcon() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="9.5" cy="26.5" r="4" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="26.5" cy="26.5" r="4" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M5.5 22.5H15L18.5 14H24.5L27.5 22.5H30.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 10.5H25.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect
        x="6.5"
        y="13"
        width="7.5"
        height="6"
        rx="1.5"
        fill="currentColor"
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
  const [dormFilter, setDormFilter] = useState<"all" | "KTX A" | "KTX B">(
    "all",
  );
  const [toast, setToast] = useState("");
  const [qrOrder, setQrOrder] = useState<DeliveryOrder | null>(null);

  const deliveringCount = orders.filter(
    (order) => order.status === "delivering",
  ).length;
  const deliveredCount =
    initialCompletedBaseCount +
    orders.filter((order) => order.status === "delivered").length;

  const visibleOrders = orders.filter((order) => {
    if (order.status !== activeTab) return false;
    if (dormFilter !== "all" && order.dorm !== dormFilter) return false;
    return true;
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
    <div className={styles.page}>
      {/* Top Header với đúng Logo của Web hiện tại */}
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
          {(
            [
              { value: "all", label: "Tất cả" },
              { value: "KTX A", label: "KTX A" },
              { value: "KTX B", label: "KTX B" },
            ] as const
          ).map((chip) => (
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
        <section className={styles.banner} aria-label="Tóm tắt đơn giao hôm nay">
          <div className={styles.bannerIconBox}>
            <ScooterIcon />
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

        {/* Danh sách Card đơn hàng */}
        {visibleOrders.length > 0 ? (
          <div className={styles.orderList}>
            {visibleOrders.map((order) => {
              const badgeLabel =
                order.badgeState === "new"
                  ? "Mới"
                  : order.badgeState === "waiting"
                    ? "Đang chờ"
                    : "Đã giao";
              const badgeClass =
                order.badgeState === "new"
                  ? styles.stateNew
                  : order.badgeState === "waiting"
                    ? styles.stateWaiting
                    : styles.stateDone;

              return (
                <article key={order.id} className={styles.orderCard}>
                  <div className={styles.orderHeader}>
                    <div className={styles.orderCodeWrap}>
                      <strong className={styles.orderCode}>
                        {order.orderCode}
                      </strong>
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
                        <span className={styles.customerName}>
                          {order.customerName}
                        </span>
                      </div>

                      <div className={styles.infoRow}>
                        <Phone
                          size={15}
                          className={styles.infoIcon}
                          aria-hidden="true"
                        />
                        <span className={styles.customerPhone}>
                          {order.phone}
                        </span>
                      </div>

                      <div className={styles.infoRow}>
                        <MapPin
                          size={16}
                          className={styles.pinIcon}
                          aria-hidden="true"
                        />
                        <span className={styles.dormBadge}>{order.dorm}</span>
                        <span className={styles.addressDetail}>
                          {order.addressDetail}
                        </span>
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
                    <span className={styles.itemsText}>
                      {order.items.join("  •  ")}
                    </span>
                  </div>

                  <div className={styles.actionsGrid}>
                    <a
                      href={`tel:${order.phone.replace(/\s+/g, "")}`}
                      className={styles.callBtn}
                    >
                      <Phone size={15} aria-hidden="true" />
                      Gọi khách
                    </a>

                    {order.status === "delivering" ? (
                      <button
                        type="button"
                        className={styles.completeBtn}
                        onClick={() =>
                          handleMarkDelivered(order.id, order.orderCode)
                        }
                      >
                        <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                        Đánh dấu đã giao
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className={`${styles.completeBtn} ${styles.completeBtnDone}`}
                      >
                        <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                        Đã giao thành công
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className={styles.qrBtn}
                    onClick={() => setQrOrder(order)}
                  >
                    <QrCode size={15} aria-hidden="true" />
                    Mã QR
                  </button>
                </article>
              );
            })}
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
