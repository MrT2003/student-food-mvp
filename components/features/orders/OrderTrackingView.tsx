"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Check,
  ClipboardList,
  Clock3,
  CreditCard,
  Lightbulb,
  MapPin,
  Milk,
  Store,
  Utensils,
  X,
} from "lucide-react";
import {
  formatOrderMoney,
  type OrderDetail,
  type OrderDetailStatus,
} from "@/lib/orders/order-detail";
import styles from "@/styles/order-tracking.module.css";
import { useOrderDetail } from "@/lib/orders/useOrderDetail";
import OrderStatusBadge from "@/components/ui/OrderStatusBadge";
import SectionHeading from "@/components/ui/SectionHeading";
import { formatOrderDate } from "@/lib/orders/order-mappers";

type TimelineStep = {
  id: string;
  title: string;
  description: string;
  time?: string;
  state: "done" | "waiting" | "failed";
  current: boolean;
};

function getTimeline(order: OrderDetail): TimelineStep[] {
  const ended = order.status === "cancelled" || order.status === "rejected";

  if (ended) {
    return [
      {
        id: "placed",
        title: "Đã đặt hàng",
        description: "Đơn hàng của bạn đã được ghi nhận.",
        time: order.placedAt,
        state: "done",
        current: false,
      },
      {
        id: "closed",
        title:
          order.status === "cancelled"
            ? "Đơn hàng đã hủy"
            : "Cửa hàng đã từ chối",
        description:
          order.status === "cancelled"
            ? "Đơn hàng đã kết thúc và không tiếp tục xử lý."
            : "Cửa hàng không tiếp nhận đơn hàng này.",
        state: "failed",
        current: true,
      },
    ];
  }

  const accepted = order.status === "accepted" || order.status === "completed";
  const completed = order.status === "completed";

  return [
    {
      id: "placed",
      title: "Đã đặt hàng",
      description: "Đơn hàng của bạn đã được ghi nhận.",
      time: order.placedAt,
      state: "done",
      current: order.status === "pending",
    },
    {
      id: "accepted",
      title: accepted ? "Cửa hàng đã chấp nhận" : "Chờ cửa hàng chấp nhận",
      description: accepted
        ? "Cửa hàng đã xác nhận và bắt đầu chuẩn bị."
        : "Cửa hàng sẽ sớm kiểm tra và xác nhận đơn hàng.",

      time:
        accepted && order.acceptedAt
          ? formatOrderDate(order.acceptedAt)
          : undefined,
      state: accepted ? "done" : "waiting",
      current: order.status === "accepted",
    },
    {
      id: "completed",
      title: "Hoàn thành",
      description: completed
        ? "Đơn hàng đã hoàn thành. Chúc bạn ngon miệng!"
        : "Đơn hàng sẽ được hoàn thành trong thời gian sớm nhất.",
      time:
        completed && order.completedAt
          ? formatOrderDate(order.completedAt)
          : undefined,
      state: completed ? "done" : "waiting",
      current: completed,
    },
  ];
}

function StatusBadge({ status }: { status: OrderDetailStatus }) {
  return (
    <OrderStatusBadge
      status={status}
      className={`${styles.badge} ${styles[status]}`}
    />
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
    <SectionHeading
      icon={icon}
      className={styles.sectionTitle}
      iconClassName={styles.sectionIcon}
    >
      {children}
    </SectionHeading>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.infoRow}>
      <dt>
        {icon}
        <span>{label}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function OrderTrackingView({ orderId }: { orderId: string }) {
  const order = useOrderDetail(orderId);

  if (!order) {
    return (
      <div className={styles.page}>
        <section className={`${styles.card} ${styles.empty}`}>
          <h1>Không tìm thấy đơn hàng</h1>
          <p>
            Không có dữ liệu cho đơn #{orderId}. Đơn vừa tạo trong bản preview
            có thể mất khi tải lại trang.
          </p>
          <Link href="/orders" className={styles.outlineButton}>
            Về đơn hàng của tôi
          </Link>
        </section>
      </div>
    );
  }

  const timeline = getTimeline(order);
  const total = order.total;

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1>Theo dõi đơn hàng</h1>
        <p>Cập nhật trạng thái đơn hàng của bạn theo thời gian thực.</p>
      </header>

      <div className={styles.columns}>
        <div className={styles.leftColumn}>
          <section
            className={`${styles.card} ${styles.restaurantCard}`}
            aria-label="Tóm tắt đơn hàng"
          >
            <div className={styles.restaurantImage}>
              <FoodPlaceholder kind={order.kind} />
            </div>

            <div className={styles.restaurantContent}>
              <div className={styles.restaurantTitle}>
                <h2>{order.restaurantName}</h2>
                <StatusBadge status={order.status} />
              </div>

              <p className={styles.orderCode}>Đơn hàng #{order.orderCode}</p>

              <div className={styles.metadata}>
                <span>
                  <MapPin size={22} aria-hidden="true" />
                  {order.restaurantLocation}
                </span>
                <span>
                  <Utensils size={21} aria-hidden="true" />
                  {order.quantity} món
                </span>
                <span>
                  <CreditCard size={23} aria-hidden="true" />
                  {order.payment}
                </span>
              </div>

              <p className={styles.placedAt}>
                <Clock3 size={22} aria-hidden="true" />
                {order.placedAt}
              </p>
            </div>
          </section>

          <section className={`${styles.card} ${styles.trackingCard}`}>
            <SectionTitle icon={<Clock3 size={25} aria-hidden="true" />}>
              Trạng thái đơn hàng
            </SectionTitle>

            <ol className={styles.timeline} aria-label="Tiến trình đơn hàng">
              {timeline.map((step, index) => {
                const nextStep = timeline[index + 1];
                const greenLine =
                  step.state === "done" && nextStep?.state !== "failed";

                return (
                  <li
                    key={step.id}
                    className={`${styles.step} ${
                      greenLine ? styles.greenLine : ""
                    }`}
                    aria-current={step.current ? "step" : undefined}
                  >
                    <span
                      className={`${styles.stepMarker} ${styles[step.state]}`}
                      aria-hidden="true"
                    >
                      {step.state === "done" && <Check size={25} />}
                      {step.state === "failed" && <X size={24} />}
                    </span>

                    <div className={styles.stepContent}>
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                      {step.time && (
                        <p className={styles.stepTime}>{step.time}</p>
                      )}
                      <span className={styles.srOnly}>
                        {step.state === "done"
                          ? "Bước đã hoàn tất."
                          : step.state === "waiting"
                            ? "Bước chưa hoàn tất."
                            : "Đơn hàng đã dừng."}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>

            <aside className={styles.infoBanner}>
              <span className={styles.bulbIcon}>
                <Lightbulb size={29} aria-hidden="true" />
              </span>
              <div>
                <h3>Mỗi cửa hàng là một đơn hàng riêng.</h3>
                <p>Bạn đang theo dõi đơn của {order.restaurantName}.</p>
              </div>
            </aside>

            <div className={styles.actions}>
              <Link
                href={`/orders/${encodeURIComponent(order.id)}`}
                className={styles.outlineButton}
              >
                Xem chi tiết
              </Link>

              <Link href="/orders" className={styles.primaryButton}>
                Về đơn hàng của tôi
              </Link>
            </div>
          </section>
        </div>

        <aside className={styles.rightColumn}>
          <section className={`${styles.card} ${styles.sideCard}`}>
            <SectionTitle icon={<ClipboardList size={24} aria-hidden="true" />}>
              Thông tin đơn hàng
            </SectionTitle>

            <dl className={styles.infoList}>
              <InfoRow
                icon={<Store size={23} aria-hidden="true" />}
                label="Cửa hàng"
              >
                <strong>{order.restaurantName}</strong>
              </InfoRow>

              <InfoRow
                icon={<MapPin size={23} aria-hidden="true" />}
                label="Khu vực"
              >
                <strong>{order.restaurantLocation}</strong>
              </InfoRow>

              <InfoRow
                icon={<Utensils size={22} aria-hidden="true" />}
                label="Số lượng món"
              >
                {order.quantity} món
              </InfoRow>

              <InfoRow
                icon={<CreditCard size={23} aria-hidden="true" />}
                label="Phương thức thanh toán"
              >
                {order.payment}
              </InfoRow>

              <div className={styles.totalRow}>
                <dt>Tổng tiền</dt>
                <dd>{formatOrderMoney(total)}</dd>
              </div>
            </dl>
          </section>

          <section className={`${styles.card} ${styles.sideCard}`}>
            <SectionTitle icon={<Utensils size={24} aria-hidden="true" />}>
              Danh sách món
            </SectionTitle>

            <ul className={styles.itemList}>
              {order.items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <div className={styles.itemImage}>
                    <FoodPlaceholder kind={item.kind} />
                  </div>

                  <div className={styles.itemContent}>
                    <h3>{item.name}</h3>
                    {item.options.length > 0 && (
                      <p>+ {item.options.join(", ")}</p>
                    )}
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

          <section className={`${styles.card} ${styles.sideCard}`}>
            <SectionTitle icon={<MapPin size={24} aria-hidden="true" />}>
              Địa chỉ nhận hàng
            </SectionTitle>
            <div className={styles.address}>
              <strong>{order.deliveryLocation}</strong>
              <p>{order.deliveryAddress || "Chưa có địa chỉ chi tiết."}</p>
            </div>
          </section>

          <section className={`${styles.card} ${styles.sideCard}`}>
            <SectionTitle icon={<ClipboardList size={24} aria-hidden="true" />}>
              Ghi chú đơn hàng
            </SectionTitle>
            <p className={styles.note}>
              {order.note.trim() || "Không có ghi chú."}
            </p>
          </section>
        </aside>
      </div>

      <p className={styles.demoNote}>
        Bản xem trước giao diện — dữ liệu mẫu, chưa cập nhật thời gian thực.
      </p>
    </div>
  );
}
