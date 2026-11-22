"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Banknote,
  Check,
  Clock3,
  CreditCard,
  Database,
  FileText,
  MapPin,
  Phone,
  User,
  Utensils,
  X,
} from "lucide-react";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import { formatMoney, normalizeSearchText } from "@/lib/format";
import styles from "@/styles/delivery.module.css";
import type {
  DeliveryOrder,
  DeliveryOrderItemDetail,
} from "./DeliveryDashboard";

export const DEFAULT_DELIVERY_ORDER_NOTE = "Gọi trước khi giao.";

export function getDeliveryOrderDishImage(dishName: string): string | null {
  const normalized = normalizeSearchText(dishName);
  if (normalized.includes("com suon")) {
    return "/delivery-order-com-suon-nuong.png";
  }
  if (normalized.includes("tra tac") || normalized.includes("tra chanh")) {
    return "/delivery-order-tra-tac.png";
  }
  if (normalized.includes("tra dao")) {
    return "/seller-menu-tra-dao-cam-sa.png";
  }
  if (normalized.includes("tra sua")) {
    return "/seller-order-tra-sua.png";
  }
  if (normalized.includes("banh trang")) {
    return "/seller-order-banh-trang-tron.png";
  }
  if (normalized.includes("com ga") || normalized.includes("com tam")) {
    return "/seller-menu-com-ga-chien.png";
  }
  return null;
}

export function getDeliveryOrderDishUnitLabel(
  dishName: string,
  quantity: number,
): string {
  const normalized = normalizeSearchText(dishName);
  const isDrink =
    normalized.includes("tra") ||
    normalized.includes("nuoc") ||
    normalized.includes("sua");
  const unit = isDrink ? "ly" : "phần";
  return `${quantity} ${unit}`;
}

export function getDeliveryOrderDishItems(
  order: DeliveryOrder,
): DeliveryOrderItemDetail[] {
  if (order.dishItems && order.dishItems.length > 0) {
    return order.dishItems;
  }

  const count = Math.max(1, order.items.length);
  const averagePrice = Math.round(order.total / count / 1000) * 1000;

  return order.items.map((raw, index) => {
    const match = raw.trim().match(/^(.*?)\s+x(\d+)$/i);
    const name = match ? match[1].trim() : raw.trim();
    const quantity = match ? Math.max(1, Number.parseInt(match[2], 10)) : 1;
    const isLast = index === count - 1;
    const price = isLast
      ? Math.max(0, order.total - averagePrice * (count - 1))
      : averagePrice;

    return {
      id: `${order.id}-item-${index + 1}`,
      name,
      quantity,
      unitLabel: getDeliveryOrderDishUnitLabel(name, quantity),
      price,
      imageUrl: getDeliveryOrderDishImage(name),
    };
  });
}

export function getDeliveryDetailStatusBadgeLabel(
  status: DeliveryOrder["status"],
  badgeState?: DeliveryOrder["badgeState"],
): string {
  if (status === "delivered") {
    return "Đã giao";
  }
  if (badgeState === "waiting") {
    return "Đang chờ";
  }
  return "Cần giao";
}

export function getDeliveryDetailActionButtonLabel(
  status: DeliveryOrder["status"],
): "Đánh dấu đã giao" | "Đã giao" {
  return status === "delivered" ? "Đã giao" : "Đánh dấu đã giao";
}

export function formatDeliveryDetailTimestamp(order: {
  status: DeliveryOrder["status"];
  time: string;
  deliveredAt?: string;
}): string {
  const displayTime = order.deliveredAt ?? order.time;
  return order.status === "delivered"
    ? `Đã giao lúc ${displayTime}`
    : `Đặt lúc ${order.time}`;
}

export type DeliveryOrderDetailModalProps = {
  order: DeliveryOrder;
  onClose?: () => void;
  onMarkDelivered?: (orderId: string, orderCode: string) => void;
};

export default function DeliveryOrderDetailModal({
  order,
  onClose,
  onMarkDelivered,
}: DeliveryOrderDetailModalProps) {
  const [markedOrderId, setMarkedOrderId] = useState<string | null>(null);

  const effectiveStatus: DeliveryOrder["status"] =
    order.status === "delivered" || markedOrderId === order.id
      ? "delivered"
      : "delivering";
  const isDelivered = effectiveStatus === "delivered";

  const dishItems = getDeliveryOrderDishItems(order);
  const statusBadgeLabel = getDeliveryDetailStatusBadgeLabel(
    effectiveStatus,
    order.badgeState,
  );
  const actionButtonLabel = getDeliveryDetailActionButtonLabel(effectiveStatus);
  const timestampLabel = formatDeliveryDetailTimestamp({
    status: effectiveStatus,
    time: order.time,
    deliveredAt: order.deliveredAt,
  });
  const noteText =
    order.note && order.note.trim().length > 0
      ? order.note.trim()
      : DEFAULT_DELIVERY_ORDER_NOTE;

  function handleMarkAsDelivered() {
    if (isDelivered) return;
    setMarkedOrderId(order.id);
    onMarkDelivered?.(order.id, order.orderCode);
  }

  return (
    <div
      className={styles.detailSheetBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-detail-title"
      data-testid="delivery-order-detail-modal"
      data-order-code={order.orderCode}
      data-order-status={effectiveStatus}
      onClick={() => onClose?.()}
    >
      <div
        className={styles.detailSheetCard}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.detailSheetHandleWrap} aria-hidden="true">
          <span className={styles.detailSheetHandle} />
        </div>

        {/* Header: Chi tiết đơn hàng + Nút đóng X */}
        <div className={styles.detailSheetTopRow}>
          <h2 id="delivery-detail-title" className={styles.detailSheetTitle}>
            Chi tiết đơn hàng
          </h2>
          <button
            type="button"
            className={styles.detailSheetCloseIconBtn}
            onClick={() => onClose?.()}
            aria-label="Đóng chi tiết đơn hàng"
          >
            <X size={22} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        {/* Mã đơn + Trạng thái + Thời gian */}
        <div className={styles.detailOrderMetaHeader}>
          <div className={styles.detailOrderCodeRow}>
            <strong className={styles.detailOrderCode}>
              {order.orderCode}
            </strong>
            <span
              className={`${styles.detailStatusPill} ${
                isDelivered
                  ? styles.detailStatusPillDelivered
                  : styles.detailStatusPillDelivering
              }`}
              data-testid="delivery-detail-status-badge"
            >
              {statusBadgeLabel}
            </span>
          </div>

          <p className={styles.detailTimestampRow}>
            <Clock3 size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>{timestampLabel}</span>
          </p>
        </div>

        {/* Nội dung các thẻ thông tin */}
        <div className={styles.detailSectionsStack}>
          {/* Card 1: Khách hàng */}
          <section
            className={styles.detailSectionCard}
            aria-label="Thông tin khách hàng"
          >
            <div className={styles.detailSectionHeader}>
              <User
                size={16}
                strokeWidth={2.4}
                className={styles.detailSectionIcon}
                aria-hidden="true"
              />
              <h3 className={styles.detailSectionTitle}>Khách hàng</h3>
            </div>

            <div className={styles.detailCustomerMain}>
              <div className={styles.detailCustomerIdentity}>
                <strong className={styles.detailCustomerName}>
                  {order.customerName}
                </strong>
                <div className={styles.detailCustomerPhoneRow}>
                  <Phone
                    size={14}
                    strokeWidth={2.2}
                    className={styles.detailCustomerPhoneIcon}
                    aria-hidden="true"
                  />
                  <span className={styles.detailCustomerPhone}>
                    {order.phone}
                  </span>
                </div>
              </div>

              <a
                href={`tel:${order.phone.replace(/\s+/g, "")}`}
                className={styles.detailCallCustomerBtn}
                aria-label={`Gọi khách ${order.customerName}`}
              >
                <Phone size={15} strokeWidth={2.3} aria-hidden="true" />
                <span>Gọi khách</span>
              </a>
            </div>

            <div className={styles.detailAddressRow}>
              <MapPin
                size={16}
                strokeWidth={2.3}
                className={styles.detailAddressPin}
                aria-hidden="true"
              />
              <span className={styles.detailDormBadge}>{order.dorm}</span>
              <span className={styles.detailAddressText}>
                {order.addressDetail}
              </span>
            </div>
          </section>

          {/* Card 2: Món ăn */}
          <section
            className={styles.detailSectionCard}
            aria-label="Danh sách món ăn"
          >
            <div className={styles.detailSectionHeader}>
              <Utensils
                size={16}
                strokeWidth={2.4}
                className={styles.detailSectionIcon}
                aria-hidden="true"
              />
              <h3 className={styles.detailSectionTitle}>Món ăn</h3>
            </div>

            <div className={styles.detailDishList}>
              {dishItems.map((dish) => (
                <div key={dish.id} className={styles.detailDishRow}>
                  <div className={styles.detailDishThumbWrap}>
                    {dish.imageUrl ? (
                      <Image
                        src={dish.imageUrl}
                        alt={dish.name}
                        width={55}
                        height={38}
                        unoptimized
                        className={styles.detailDishThumb}
                      />
                    ) : (
                      <FoodThumbnail
                        kind={
                          normalizeSearchText(dish.name).includes("tra")
                            ? "drink"
                            : "food"
                        }
                        className={styles.detailDishThumb}
                      />
                    )}
                  </div>

                  <div className={styles.detailDishCopy}>
                    <strong className={styles.detailDishName}>
                      {dish.name}
                    </strong>
                    <span className={styles.detailDishMultiplier}>
                      x{dish.quantity}
                    </span>
                  </div>

                  <span className={styles.detailDishUnit}>
                    {dish.unitLabel}
                  </span>

                  <strong className={styles.detailDishPrice}>
                    {formatMoney(dish.price)}
                  </strong>
                </div>
              ))}
            </div>
          </section>

          {/* Card 3: Thanh toán & Tổng tiền */}
          <section
            className={`${styles.detailSectionCard} ${styles.detailPaymentCard}`}
            aria-label="Thanh toán và tổng tiền"
          >
            <div className={styles.detailPaymentRow}>
              <div className={styles.detailPaymentLabelGroup}>
                <CreditCard
                  size={17}
                  strokeWidth={2.2}
                  className={styles.detailSectionIcon}
                  aria-hidden="true"
                />
                <span className={styles.detailPaymentLabel}>Thanh toán</span>
              </div>

              <span
                className={`${styles.detailPaymentMethodBadge} ${
                  order.paymentMethod === "cash"
                    ? styles.detailPaymentCash
                    : styles.detailPaymentTransfer
                }`}
              >
                {order.paymentMethod === "cash" ? (
                  <>
                    <Banknote size={14} strokeWidth={2.2} aria-hidden="true" />
                    <span>Tiền mặt</span>
                  </>
                ) : (
                  <>
                    <CreditCard
                      size={14}
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                    <span>Chuyển khoản</span>
                  </>
                )}
              </span>
            </div>

            <div className={styles.detailTotalRow}>
              <div className={styles.detailPaymentLabelGroup}>
                <Database
                  size={17}
                  strokeWidth={2.2}
                  className={styles.detailSectionIcon}
                  aria-hidden="true"
                />
                <span className={styles.detailTotalLabel}>Tổng tiền</span>
              </div>

              <strong className={styles.detailTotalValue}>
                {formatMoney(order.total)}
              </strong>
            </div>
          </section>

          {/* Card 4: Ghi chú đơn hàng */}
          <section
            className={styles.detailSectionCard}
            aria-label="Ghi chú đơn hàng"
          >
            <div className={styles.detailSectionHeader}>
              <FileText
                size={16}
                strokeWidth={2.2}
                className={styles.detailSectionIcon}
                aria-hidden="true"
              />
              <h3 className={styles.detailSectionTitle}>Ghi chú đơn hàng</h3>
            </div>
            <p className={styles.detailNoteText}>{noteText}</p>
          </section>
        </div>

        {/* Cụm nút hành động cuối popup */}
        <div className={styles.detailFooterActions}>
          {isDelivered ? (
            <button
              type="button"
              disabled
              className={`${styles.detailPrimaryActionBtn} ${styles.detailPrimaryActionBtnDone}`}
              data-testid="delivery-detail-status-action-btn"
              data-delivery-status="delivered"
            >
              <Check size={19} strokeWidth={2.8} aria-hidden="true" />
              <span>{actionButtonLabel}</span>
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.detailPrimaryActionBtn} ${styles.detailPrimaryActionBtnPending}`}
              data-testid="delivery-detail-status-action-btn"
              data-delivery-status="delivering"
              onClick={handleMarkAsDelivered}
            >
              <Check size={19} strokeWidth={2.8} aria-hidden="true" />
              <span>{actionButtonLabel}</span>
            </button>
          )}

          <button
            type="button"
            className={styles.detailCloseActionBtn}
            data-testid="delivery-detail-close-btn"
            onClick={() => onClose?.()}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
