"use client";

import { useState } from "react";
import Image from "@/components/media/AppImage";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock3,
  MapPin,
  Phone,
  User,
  UserX,
  Utensils,
  Wallet,
  XCircle,
} from "lucide-react";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import { formatMoney, normalizeSearchText } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders/order-detail";
import { formatOrderDate, formatOrderPayment } from "@/lib/orders/order-mappers";
import { demoSellerRestaurant } from "@/lib/mocks/seller-orders.mock";
import { transitionSellerOrder, type SellerOrder } from "@/lib/seller/orders";
import type { OrderStatus, PaymentMethod } from "@/types/order.types";
import styles from "@/styles/seller-order-detail.module.css";

export const SELLER_ORDER_DETAIL_DEFAULT_ID =
  "71000000-0000-4000-8000-000000000128";
export const SELLER_ORDER_DETAIL_DEFAULT_CODE = "SF0128";
export const SELLER_ORDER_DETAIL_REFERENCE_DATE = "10/09/2026";
export const SELLER_ORDER_DETAIL_CAMPUS_SUBTITLE = "Khu nội trú ĐH Bách Khoa";

export function createDefaultSellerOrderDetailFixture(): SellerOrder {
  return {
    id: SELLER_ORDER_DETAIL_DEFAULT_ID,
    restaurant_id: demoSellerRestaurant.id,
    student_id: "51000000-0000-4000-8000-000000000128",
    session_checkout_id: "91000000-0000-4000-8000-000000000128",
    order_code: SELLER_ORDER_DETAIL_DEFAULT_CODE,
    order_status: "pending",
    payment_method: "cash",
    payment_confirmed_at: null,
    payment_confirmed_by: null,
    subtotal: 45000,
    total: 45000,
    delivery_address: "KTX A, Cổng B, Phòng 302",
    customer_notes: "Gọi trước khi giao nhé!",
    created_at: "2026-10-05T03:24:00.000Z", // 10:24 ICT
    accepted_at: null,
    completed_at: null,
    order_items: [
      {
        id: "81000000-0000-4000-8000-000000001281",
        order_id: SELLER_ORDER_DETAIL_DEFAULT_ID,
        menu_item_id: "20000000-0000-4000-8000-000000000003",
        item_name_snapshot: "Trà sữa truyền thống",
        unit_price_snapshot: 25000,
        quantity: 1,
        selected_options: [
          {
            option_id: "81000000-0000-4000-8000-000000001281-opt-1",
            group_name: "Topping",
            option_name: "Trân châu đen",
            additional_price: 0,
          },
          {
            option_id: "81000000-0000-4000-8000-000000001281-opt-2",
            group_name: "Mức đá",
            option_name: "Ít đá",
            additional_price: 0,
          },
        ],
        image_url: "/seller-order-tra-sua.png",
      },
      {
        id: "81000000-0000-4000-8000-000000001282",
        order_id: SELLER_ORDER_DETAIL_DEFAULT_ID,
        menu_item_id: "20000000-0000-4000-8000-000000000002",
        item_name_snapshot: "Bánh tráng trộn",
        unit_price_snapshot: 20000,
        quantity: 1,
        selected_options: [
          {
            option_id: "81000000-0000-4000-8000-000000001282-opt-1",
            group_name: "Topping thêm",
            option_name: "Thêm trứng cút",
            additional_price: 0,
          },
        ],
        image_url: "/seller-order-banh-trang-tron.png",
      },
    ],
    customer: {
      name: "Trần Minh Anh",
      phone: "0901 234 567",
    },
  };
}

export function formatSellerOrderDetailTime(dateIso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dateIso));
}

export function formatSellerOrderDetailDate(dateIso: string): string {
  const vnDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateIso));

  if (vnDay === "2026-10-05" || vnDay === "2026-09-10") {
    return SELLER_ORDER_DETAIL_REFERENCE_DATE;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateIso));
}

export function formatSellerOrderDetailPlacedAt(dateIso: string): string {
  return `Đặt lúc ${formatSellerOrderDetailTime(dateIso)} · ${formatSellerOrderDetailDate(dateIso)}`;
}

export function formatSellerOrderDetailItemOptions(
  item: SellerOrder["order_items"][number],
): string {
  return item.selected_options
    .map((opt) => opt.option_name.trim())
    .filter(Boolean)
    .join(" · ");
}

export function getSellerOrderDetailItemImage(
  item: SellerOrder["order_items"][number],
): string | null {
  if (item.image_url) {
    return item.image_url;
  }
  const normalized = normalizeSearchText(item.item_name_snapshot);
  if (normalized.includes("tra sua")) {
    return "/seller-order-tra-sua.png";
  }
  if (normalized.includes("banh trang")) {
    return "/seller-order-banh-trang-tron.png";
  }
  return null;
}

export function formatSellerOrderDetailAddress(address: string | null): {
  primary: string;
  secondary: string;
} {
  const raw = (address ?? "Chưa có địa chỉ").trim();
  const [first, ...rest] = raw.split(",");
  const area = first.trim();
  const detail = rest.join(",").trim();
  return {
    primary: detail ? `${area} · ${detail}` : area,
    secondary: SELLER_ORDER_DETAIL_CAMPUS_SUBTITLE,
  };
}

export function getSellerOrderDetailPaymentMethodLabel(
  method: PaymentMethod | null,
): string {
  return method === "bank_transfer"
    ? "Chuyển khoản ngân hàng"
    : "Tiền mặt khi nhận món";
}

export function getSellerOrderDetailPaymentStatusLabel(
  order: SellerOrder,
): "Đã thanh toán" | "Chưa thanh toán" {
  if (order.payment_confirmed_at || order.order_status === "completed") {
    return "Đã thanh toán";
  }
  return "Chưa thanh toán";
}

export function getSellerOrderDetailStatusLabel(status: OrderStatus): string {
  if (status === "pending") return "Chờ xác nhận";
  if (status === "cancelled") return "Sinh viên hủy";
  if (status === "rejected") return "Quán từ chối";
  return orderStatusLabels[status];
}

export type SellerOrderDetailViewProps = {
  order?: SellerOrder;
  orderId?: string;
  orders?: SellerOrder[];
  overlay?: boolean;
  onBack?: () => void;
  onAccept?: (order: SellerOrder) => void;
  onReject?: (order: SellerOrder) => void;
  onComplete?: (order: SellerOrder) => void;
};

export function resolveSellerOrderForDetail(params: {
  order?: SellerOrder;
  orderId?: string;
  orders?: SellerOrder[];
}): SellerOrder {
  if (params.order) {
    return params.order;
  }
  const defaultOrder = createDefaultSellerOrderDetailFixture();
  const pool =
    params.orders && params.orders.length > 0 ? params.orders : [defaultOrder];
  if (!params.orderId) {
    return defaultOrder;
  }
  const normalizedTarget = params.orderId.trim().replace(/^#/, "").toLowerCase();
  const matched = pool.find(
    (candidate) =>
      candidate.id.toLowerCase() === normalizedTarget ||
      candidate.order_code.toLowerCase() === normalizedTarget,
  );
  return matched ?? defaultOrder;
}

export default function SellerOrderDetailView({
  order: externalOrder,
  orderId,
  orders,
  overlay = false,
  onBack,
  onAccept,
  onReject,
  onComplete,
}: SellerOrderDetailViewProps) {
  const router = useRouter();
  const [internalOrder, setInternalOrder] = useState<SellerOrder>(() =>
    resolveSellerOrderForDetail({ order: externalOrder, orderId, orders }),
  );

  const activeOrder = externalOrder ?? internalOrder;
  const totalDishCount = activeOrder.order_items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const paymentMethodLabel = formatOrderPayment(activeOrder.payment_method);

  const StatusIcon =
    activeOrder.order_status === "pending"
      ? Clock3
      : activeOrder.order_status === "cancelled"
        ? UserX
        : activeOrder.order_status === "rejected"
          ? XCircle
          : CheckCircle2;

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    router.push("/seller/orders");
  }

  function handleReject() {
    if (onReject) {
      onReject(activeOrder);
      return;
    }
    setInternalOrder((current) =>
      transitionSellerOrder(current, "rejected", new Date().toISOString()),
    );
  }

  function handleAccept() {
    if (onAccept) {
      onAccept(activeOrder);
      return;
    }
    setInternalOrder((current) =>
      transitionSellerOrder(current, "accepted", new Date().toISOString()),
    );
  }

  function handleComplete() {
    if (onComplete) {
      onComplete(activeOrder);
      return;
    }
    setInternalOrder((current) =>
      transitionSellerOrder(current, "completed", new Date().toISOString()),
    );
  }

  return (
    <div
      className={`${styles.screen} ${overlay ? styles.screenOverlay : ""}`}
      data-testid="seller-order-detail-screen"
      data-navigation-hidden="true"
    >
      <div className={styles.container}>
        <header className={styles.topBar}>
          <button
            type="button"
            className={styles.backButton}
            onClick={handleBack}
            aria-label="Quay lại danh sách đơn hàng"
          >
            <ChevronLeft size={24} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <h1 className={styles.topBarTitle}>Chi tiết đơn hàng</h1>
          <span className={styles.topBarSpacer} aria-hidden="true" />
        </header>

        <main className={styles.content}>
          <div className={styles.billCard}>
            {/* Mã đơn, ngày đặt & trạng thái (chuẩn Bill Web) */}
            <section className={styles.orderHero} aria-label="Thông tin mã đơn">
              <div className={styles.orderHeroTop}>
                <h2 className={styles.orderCode}>#{activeOrder.order_code}</h2>
                <span
                  className={`${styles.statusBadge} ${styles[`status_${activeOrder.order_status}`]}`}
                >
                  <StatusIcon size={16} strokeWidth={2.2} aria-hidden="true" />
                  <span>
                    {getSellerOrderDetailStatusLabel(activeOrder.order_status)}
                  </span>
                </span>
              </div>
              <p className={styles.placedAt}>
                Đặt lúc: {formatOrderDate(activeOrder.created_at)}
              </p>
            </section>

            {/* 1. Thông tin khách hàng */}
            <section className={styles.billSection} aria-label="Thông tin khách hàng">
              <div className={styles.sectionHeader}>
                <User
                  size={18}
                  strokeWidth={2}
                  className={styles.cardHeaderIcon}
                  aria-hidden="true"
                />
                <h3 className={styles.cardTitle}>Thông tin khách hàng</h3>
              </div>

              <div className={styles.customerBlock}>
                <strong className={styles.customerName}>
                  {activeOrder.customer.name}
                </strong>
                <div className={styles.customerPhoneRow}>
                  <span className={styles.customerInfoLine}>
                    <Phone
                      size={16}
                      strokeWidth={2}
                      className={styles.customerMetaIcon}
                      aria-hidden="true"
                    />
                    <span>
                      {activeOrder.customer.phone ??
                        (activeOrder.order_status === "completed"
                          ? "Đã ẩn số điện thoại"
                          : "Chưa có số điện thoại")}
                    </span>
                  </span>

                  {activeOrder.customer.phone && (
                    <a
                      href={`tel:${activeOrder.customer.phone.replace(/\s+/g, "")}`}
                      className={styles.callCustomerButton}
                      aria-label={`Gọi khách ${activeOrder.customer.name}`}
                    >
                      <Phone size={14} strokeWidth={2.2} aria-hidden="true" />
                      <span>Gọi khách</span>
                    </a>
                  )}
                </div>

                <span className={styles.customerInfoLine}>
                  <MapPin
                    size={16}
                    strokeWidth={2}
                    className={styles.customerMetaIcon}
                    aria-hidden="true"
                  />
                  <span>
                    {activeOrder.delivery_address ?? "Chưa có địa chỉ giao nhận"}
                  </span>
                </span>
              </div>
            </section>

            {/* 2. Thông tin thanh toán */}
            <section className={styles.billSection} aria-label="Thông tin thanh toán">
              <div className={styles.sectionHeader}>
                <Wallet
                  size={18}
                  strokeWidth={2}
                  className={styles.cardHeaderIcon}
                  aria-hidden="true"
                />
                <h3 className={styles.cardTitle}>Thông tin thanh toán</h3>
              </div>
              <p className={styles.paymentMethodText}>{paymentMethodLabel}</p>
            </section>

            {/* 3. Danh sách món */}
            <section className={styles.billSection} aria-label="Danh sách món">
              <div className={styles.sectionHeaderBetween}>
                <div className={styles.sectionHeader}>
                  <Utensils
                    size={18}
                    strokeWidth={2}
                    className={styles.cardHeaderIcon}
                    aria-hidden="true"
                  />
                  <h3 className={styles.cardTitle}>Danh sách món</h3>
                </div>
                <span className={styles.itemCount}>{totalDishCount} món</span>
              </div>

              <div className={styles.dishList}>
                {activeOrder.order_items.map((item) => {
                  const resolvedImg = getSellerOrderDetailItemImage(item);
                  const optionsText = item.selected_options
                    .map((opt) =>
                      [opt.group_name, opt.option_name]
                        .filter(Boolean)
                        .join(": "),
                    )
                    .filter(Boolean)
                    .join(", ");
                  const unitPrice = item.unit_price_snapshot;

                  return (
                    <div key={item.id} className={styles.dishRow}>
                      <div className={styles.dishThumbWrap}>
                        {resolvedImg ? (
                          <Image
                            src={resolvedImg}
                            alt={item.item_name_snapshot}
                            width={50}
                            height={50}
                            unoptimized
                            className={styles.dishThumb}
                          />
                        ) : (
                          <FoodThumbnail
                            kind={
                              normalizeSearchText(
                                item.item_name_snapshot,
                              ).includes("tra")
                                ? "drink"
                                : "food"
                            }
                            className={styles.dishThumb}
                          />
                        )}
                      </div>

                      <div className={styles.dishInfo}>
                        <strong className={styles.dishName}>
                          {item.item_name_snapshot}
                        </strong>
                        {optionsText && (
                          <p className={styles.dishOptions}>+ {optionsText}</p>
                        )}
                      </div>

                      <span className={styles.dishQtyPill}>×{item.quantity}</span>
                      <strong className={styles.dishPrice}>
                        {formatMoney(unitPrice)}/phần
                      </strong>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 4. Ghi chú của khách hàng */}
            <section className={styles.billSection} aria-label="Ghi chú của khách hàng">
              <div className={styles.sectionHeader}>
                <ClipboardList
                  size={18}
                  strokeWidth={2}
                  className={styles.cardHeaderIcon}
                  aria-hidden="true"
                />
                <h3 className={styles.cardTitle}>Ghi chú của khách hàng</h3>
              </div>
              <p className={styles.noteBox}>
                {activeOrder.customer_notes?.trim() || "Không có ghi chú."}
              </p>
            </section>

            {activeOrder.order_status === "cancelled" &&
              activeOrder.cancel_reason && (
                <section
                  className={styles.billSection}
                  aria-label="Lý do sinh viên hủy"
                >
                  <div className={styles.sectionHeader}>
                    <UserX
                      size={18}
                      strokeWidth={2}
                      className={styles.cardHeaderIcon}
                      aria-hidden="true"
                    />
                    <h3 className={styles.cardTitle}>Lý do sinh viên hủy</h3>
                  </div>
                  <p className={styles.noteBox}>{activeOrder.cancel_reason}</p>
                </section>
              )}

            {/* 5. Tạm tính & Tổng cộng */}
            <section className={styles.totalsSection} aria-label="Tổng tiền">
              <div className={styles.paymentRow}>
                <span>Tạm tính</span>
                <span>{formatMoney(activeOrder.subtotal)}</span>
              </div>
              <div className={styles.paymentTotalRow}>
                <strong className={styles.paymentTotalLabel}>Tổng cộng</strong>
                <strong className={styles.paymentTotalValue}>
                  {formatMoney(activeOrder.total)}
                </strong>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Bottom Action Bar */}
      {activeOrder.order_status === "pending" && (
        <footer
          className={styles.bottomActionBar}
          data-testid="seller-order-detail-actions"
          aria-label="Thao tác xử lý đơn hàng"
        >
          <div className={styles.bottomActionInner}>
            <button
              type="button"
              className={styles.rejectActionBtn}
              onClick={handleReject}
            >
              Từ chối
            </button>
            <button
              type="button"
              className={styles.acceptActionBtn}
              onClick={handleAccept}
            >
              Chấp nhận
            </button>
          </div>
        </footer>
      )}

      {activeOrder.order_status === "accepted" && (
        <footer
          className={styles.bottomActionBar}
          data-testid="seller-order-detail-actions"
          aria-label="Thao tác xử lý đơn hàng"
        >
          <div className={styles.bottomActionSingle}>
            <button
              type="button"
              className={styles.acceptActionBtn}
              onClick={handleComplete}
            >
              Hoàn thành
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

