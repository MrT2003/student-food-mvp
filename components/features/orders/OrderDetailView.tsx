"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock3,
  CreditCard,
  Info,
  MapPin,
  Milk,
  Utensils,
} from "lucide-react";

import { cartRestaurants } from "@/lib/cart/mock-data";
import {
  formatOrderMoney,
  findMockOrderDetail,
  orderStatusLabels,
  type OrderDetail,
  type OrderDetailStatus,
} from "@/lib/orders/order-detail";
import { useOrderPreviewStore } from "@/store/useOrderPreviewStore";
import styles from "@/styles/order-detail.module.css";

function StatusBadge({ status }: { status: OrderDetailStatus }) {
  const Icon =
    status === "pending"
      ? Clock3
      : status === "cancelled" || status === "rejected"
        ? CircleX
        : CircleCheck;

  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <Icon size={20} aria-hidden="true" />
      {orderStatusLabels[status]}
    </span>
  );
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

function SectionTitle({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <h2 className={styles.sectionTitle}>
      <span className={styles.sectionIcon}>{icon}</span>
      {children}
    </h2>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.detailRow}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function OrderDetailView({ orderId }: { orderId: string }) {
  const checkout = useOrderPreviewStore((state) => state.checkout);
  const previewOrder = checkout?.orders.find((order) => order.id === orderId);

  let order: OrderDetail | undefined;

  if (previewOrder && checkout) {
    // Dùng bản sao đơn hàng đã lưu khi xác nhận.
    // Không lấy lại từ giỏ hàng vì giỏ có thể đã thay đổi.
    order = {
      id: previewOrder.id,
      restaurantName: previewOrder.restaurantName,
      restaurantLocation:
        cartRestaurants.find(
          (restaurant) => restaurant.id === previewOrder.restaurantId,
        )?.location ?? "Chưa có thông tin",
      kind: previewOrder.kind,
      status: "pending",
      placedAt: "Vừa xác nhận (mẫu)",
      payment:
        previewOrder.payment === "bank"
          ? "Chuyển khoản ngân hàng"
          : "Thanh toán khi nhận món",
      note: previewOrder.note,
      deliveryLocation: checkout.location,
      deliveryAddress: checkout.address,
      deliveryFee: 0,
      items: previewOrder.items.map((item) => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        quantity: item.quantity,
        unitPrice:
          item.basePrice +
          item.extras.reduce((sum, extra) => sum + extra.price, 0),
        options: item.extras.map((extra) => extra.name),
        note: item.note,
      })),
    };
  } else {
    order = findMockOrderDetail(orderId);
  }

  if (!order) {
    return (
      <div className={styles.page}>
        <div className={`${styles.card} ${styles.empty}`}>
          <h1>Không tìm thấy đơn hàng</h1>
          <p>
            Không có dữ liệu cho đơn #{orderId}. Đơn vừa tạo trong bản preview
            có thể mất khi tải lại trang.
          </p>
          <Link href="/orders" className={styles.outlineButton}>
            <ArrowLeft size={20} aria-hidden="true" />
            Quay lại đơn hàng
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const total = subtotal + order.deliveryFee;
  const canTrack = order.status === "pending" || order.status === "accepted";

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1>Chi tiết đơn hàng</h1>
        <p>Xem đầy đủ thông tin đơn hàng của bạn.</p>
      </header>

      <section
        className={`${styles.card} ${styles.summary}`}
        aria-label="Tóm tắt đơn hàng"
      >
        <div className={styles.restaurantImage}>
          <FoodPlaceholder kind={order.kind} />
        </div>

        <div className={styles.summaryContent}>
          <div className={styles.restaurantTitle}>
            <h2>{order.restaurantName}</h2>
            <StatusBadge status={order.status} />
          </div>

          <p className={styles.orderCode}>Đơn hàng #{order.id}</p>

          <div className={styles.metadata}>
            <span>
              <MapPin size={23} aria-hidden="true" />
              {order.restaurantLocation}
            </span>

            <span>
              <Utensils size={22} aria-hidden="true" />
              {order.items.length} món
            </span>

            <span>
              <CreditCard size={24} aria-hidden="true" />
              {order.payment}
            </span>

            <span>
              <Clock3 size={23} aria-hidden="true" />
              {order.placedAt}
            </span>
          </div>
        </div>

        <div className={styles.summaryTotal}>
          <span>Tổng tiền</span>
          <strong>{formatOrderMoney(total)}</strong>
        </div>
      </section>

      <div className={styles.columns}>
        <div className={styles.leftColumn}>
          <section className={`${styles.card} ${styles.itemsCard}`}>
            <div className={styles.itemsHeading}>
              <SectionTitle icon={<Utensils size={23} aria-hidden="true" />}>
                Danh sách món
              </SectionTitle>
            </div>

            <ul className={styles.itemList}>
              {order.items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <div className={styles.itemImage}>
                    <FoodPlaceholder kind={item.kind} />
                  </div>

                  <div className={styles.itemContent}>
                    <h3>{item.name}</h3>

                    {item.options.map((option, index) => (
                      <p key={`${item.id}-${index}`}>+ {option}</p>
                    ))}

                    {item.note && <p>{item.note}</p>}
                  </div>

                  <span
                    className={styles.quantity}
                    aria-label={`Số lượng ${item.quantity}`}
                  >
                    x{item.quantity}
                  </span>

                  <strong className={styles.itemPrice}>
                    {formatOrderMoney(item.unitPrice * item.quantity)}
                  </strong>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${styles.card} ${styles.noteCard}`}>
            <SectionTitle icon={<ClipboardList size={23} aria-hidden="true" />}>
              Ghi chú đơn hàng
            </SectionTitle>

            <p className={styles.note}>
              {order.note.trim() || "Không có ghi chú."}
            </p>
          </section>

          <div className={styles.actions}>
            <Link href="/orders" className={styles.outlineButton}>
              <ArrowLeft size={23} aria-hidden="true" />
              Quay lại
            </Link>

            {canTrack && (
              <Link
                href={`/orders/${encodeURIComponent(order.id)}/tracking`}
                className={styles.primaryButton}
              >
                <MapPin size={23} aria-hidden="true" />
                Theo dõi đơn
              </Link>
            )}
          </div>
        </div>

        <aside className={styles.rightColumn}>
          <section className={`${styles.card} ${styles.sideCard}`}>
            <SectionTitle icon={<Info size={23} aria-hidden="true" />}>
              Thông tin đơn hàng
            </SectionTitle>

            <dl className={styles.details}>
              <DetailRow label="Cửa hàng">{order.restaurantName}</DetailRow>
              <DetailRow label="Khu vực">{order.restaurantLocation}</DetailRow>
              <DetailRow label="Số lượng món">
                {order.items.length} món
              </DetailRow>
              <DetailRow label="Đặt lúc">{order.placedAt}</DetailRow>
              <DetailRow label="Trạng thái">
                <StatusBadge status={order.status} />
              </DetailRow>
            </dl>
          </section>

          <section className={`${styles.card} ${styles.sideCard}`}>
            <SectionTitle icon={<CreditCard size={23} aria-hidden="true" />}>
              Thanh toán
            </SectionTitle>

            <dl className={styles.details}>
              <DetailRow label="Phương thức">{order.payment}</DetailRow>
              <DetailRow label="Tạm tính">
                {formatOrderMoney(subtotal)}
              </DetailRow>
              <DetailRow label="Phí giao hàng">
                {formatOrderMoney(order.deliveryFee)}
              </DetailRow>

              <div className={styles.grandTotal}>
                <dt>Tổng cộng</dt>
                <dd>{formatOrderMoney(total)}</dd>
              </div>
            </dl>
          </section>

          <section className={`${styles.card} ${styles.sideCard}`}>
            <SectionTitle icon={<MapPin size={23} aria-hidden="true" />}>
              Địa chỉ nhận hàng
            </SectionTitle>

            <div className={styles.address}>
              <strong>{order.deliveryLocation}</strong>
              <p>{order.deliveryAddress || "Chưa có địa chỉ chi tiết."}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
