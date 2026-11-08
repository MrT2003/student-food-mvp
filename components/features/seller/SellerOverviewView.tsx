"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Copy,
  CreditCard,
  FileText,
  Headphones,
  Lightbulb,
  Share2,
  Store,
  Utensils,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import { useSellerAccess } from "./SellerAccessProvider";
import SellerAccessProblem from "./SellerAccessProblem";
import { openSellerRestaurant } from "@/lib/seller/open-client";
import { useAuthStore } from "@/store/useAuthStore";
import styles from "@/styles/seller-overview.module.css";

export type SellerChecklistItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: "utensils" | "wallet" | "credit-card" | "store";
};

export type SellerTodayStatItem = {
  id: string;
  label: string;
  value: string;
  unit: string;
  tone: "orange-doc" | "green-check" | "gray-check" | "orange-dollar";
};

export const sellerMobileChecklistItems: readonly SellerChecklistItem[] = [
  {
    id: "first-dish",
    title: "Thêm món đầu tiên",
    description: "Tạo và đăng món ăn đầu tiên",
    href: "/seller/menu/new",
    icon: "utensils",
  },
  {
    id: "upload-avatar",
    title: "Tải ảnh đại diện",
    description: "Giúp cửa hàng của bạn nổi bật hơn",
    href: "/seller/shop",
    icon: "wallet",
  },
  {
    id: "bank-config",
    title: "Cấu hình chuyển khoản",
    description: "Nhận thanh toán qua ngân hàng",
    href: "/seller/payments",
    icon: "credit-card",
  },
  {
    id: "open-orders",
    title: "Mở nhận đơn",
    description: "Sau khi hoàn tất các bước trên",
    href: "/seller/shop",
    icon: "store",
  },
] as const;

export const sellerMobileDateOptions = [
  "Hôm nay, 10/09/2026",
  "Hôm qua, 09/09/2026",
  "7 ngày qua",
] as const;

export const sellerMobileTodayStats: readonly SellerTodayStatItem[] = [
  {
    id: "new-orders",
    label: "Đơn mới",
    value: "0",
    unit: "đơn hàng",
    tone: "orange-doc",
  },
  {
    id: "accepted-orders",
    label: "Đã chấp nhận",
    value: "0",
    unit: "đơn hàng",
    tone: "green-check",
  },
  {
    id: "completed-orders",
    label: "Hoàn thành",
    value: "0",
    unit: "đơn hàng",
    tone: "gray-check",
  },
  {
    id: "revenue",
    label: "Doanh thu",
    value: "0đ",
    unit: "hôm nay",
    tone: "orange-dollar",
  },
] as const;

function ChecklistRowIcon({ kind }: { kind: SellerChecklistItem["icon"] }) {
  if (kind === "utensils") {
    return <Utensils size={19} strokeWidth={2} aria-hidden="true" />;
  }
  if (kind === "wallet") {
    return <Wallet size={19} strokeWidth={2} aria-hidden="true" />;
  }
  if (kind === "credit-card") {
    return <CreditCard size={19} strokeWidth={2} aria-hidden="true" />;
  }
  return <Store size={19} strokeWidth={2} aria-hidden="true" />;
}

function MobileStatIcon({ tone }: { tone: SellerTodayStatItem["tone"] }) {
  if (tone === "orange-doc") {
    return (
      <span
        className={`${styles.mobileStatIcon} ${styles.toneOrangeDoc}`}
        aria-hidden="true"
      >
        <span className={styles.mobileStatInnerDoc}>
          <FileText size={15} strokeWidth={2.2} />
        </span>
      </span>
    );
  }
  if (tone === "green-check") {
    return (
      <span
        className={`${styles.mobileStatIcon} ${styles.toneGreenCheck}`}
        aria-hidden="true"
      >
        <span className={styles.mobileStatInnerGreen}>
          <Check size={15} strokeWidth={3} />
        </span>
      </span>
    );
  }
  if (tone === "gray-check") {
    return (
      <span
        className={`${styles.mobileStatIcon} ${styles.toneGrayCheck}`}
        aria-hidden="true"
      >
        <span className={styles.mobileStatInnerGray}>
          <Check size={15} strokeWidth={3} />
        </span>
      </span>
    );
  }
  return (
    <span
      className={`${styles.mobileStatIcon} ${styles.toneOrangeDollar}`}
      aria-hidden="true"
    >
      <span className={styles.mobileStatInnerDollar}>$</span>
    </span>
  );
}

export default function SellerOverviewView() {
  const { data, loading } = useSellerAccess();
  const restaurant = data?.restaurant;

  const key = `${data?.user.id ?? ""}:${restaurant?.id ?? ""}`;
  const [openState, setOpenState] = useState({
    key: "",
    pending: false,
    error: "",
    message: "",
  });
  const request = useRef<{ key: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const opening = openState.key === key && openState.pending;
  const opened = restaurant?.operating_status === "open";
  const canOpen =
    !loading &&
    data?.user.role === "seller" &&
    data.user.status === "active" &&
    restaurant?.operating_status === "closed";

  async function openRestaurant() {
    if (
      !canOpen ||
      opening ||
      !data ||
      !restaurant ||
      request.current?.key === key
    )
      return;
    const marker = { key };
    request.current = marker;
    const actor = data.user.id;
    setOpenState({ key, pending: true, error: "", message: "" });
    try {
      const result = await openSellerRestaurant(actor, restaurant.id);
      if (mounted.current && useAuthStore.getState().user?.id === actor)
        setOpenState((current) =>
          current.key === key
            ? {
                ...current,
                message: result.recovered
                  ? "Đã đọc lại và xác nhận cửa hàng đang mở."
                  : result.alreadyOpen
                    ? "Cửa hàng đã mở sẵn."
                    : "Đã xác nhận cửa hàng đang mở.",
              }
            : current,
        );
    } catch (error) {
      if (mounted.current && useAuthStore.getState().user?.id === actor)
        setOpenState((current) =>
          current.key === key
            ? {
                ...current,
                error:
                  error instanceof Error
                    ? error.message
                    : "Không thể mở cửa hàng. Hãy tải lại trạng thái.",
              }
            : current,
        );
    } finally {
      if (request.current === marker) request.current = null;
      if (mounted.current)
        setOpenState((current) =>
          current.key === key ? { ...current, pending: false } : current,
        );
    }
  }

  const [notice, setNotice] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    sellerMobileDateOptions[0],
  );
  const name = restaurant?.name || "";
  const unavailable = (feature: string) =>
    setNotice(`${feature} chưa sẵn sàng.`);
  const setup = [
    {
      icon: Utensils,
      title: "Thêm món đầu tiên",
      badge: "Xem danh sách món",
      text: "Tạo món ăn, đặt giá và hình ảnh hấp dẫn để thu hút sinh viên.",
      action: "Thêm món",
    },
    {
      icon: Wallet,
      title: "Thiết lập thanh toán",
      badge: "Thiết lập phương thức thanh toán",
      text: "Cấu hình các phương thức thanh toán cho cửa hàng.",
      action: "Thiết lập",
    },
    {
      icon: Store,
      title: "Hoàn thiện thông tin cửa hàng",
      badge: restaurant?.avatar_url
        ? "Đã có ảnh đại diện"
        : "Chưa có ảnh đại diện",
      text: "Cập nhật thông tin cửa hàng để khách hàng dễ tìm thấy bạn.",
      action: "Chỉnh sửa",
    },
  ];
  if (loading && !restaurant) return <p role="status">Đang tải cửa hàng…</p>;
  if (!restaurant) return <SellerAccessProblem />;

  return (
    <div className={styles.page}>
      <StudentHeader variant="seller" />
      <div className={styles.workspace}>
        <SellerSidebar active="overview" name={name} />
        <main className={styles.main}>
          {/* Phiên bản Desktop giữ nguyên 100% */}
          <div className={styles.desktopView}>
            <header className={styles.heading}>
              <h1>Seller Dashboard</h1>
              <h2>
                Xin chào, <span>{name}</span> 👋
              </h2>
              <p>
                Cùng hoàn thiện cửa hàng để bắt đầu phục vụ các bạn sinh viên
                nhé!
              </p>
            </header>
            <div className={styles.columns}>
              <div className={styles.content}>
                <section className={styles.card}>
                  <h3>Trạng thái cửa hàng</h3>
                  <div className={styles.status}>
                    <span className={styles.storeIcon}>
                      <Store size={40} />
                    </span>
                    <div>
                      <span className={styles.closed} data-open={opened}>
                        {opened
                          ? "Đang mở"
                          : restaurant.operating_status === "paused"
                            ? "Tạm ngừng"
                            : "Tạm đóng"}
                      </span>
                      <p>Trạng thái nhận đơn của cửa hàng.</p>
                      {restaurant.status !== "active" && (
                        <small>
                          Quán đang inactive; mở nhận đơn không tự chuyển quán
                          thành active.
                        </small>
                      )}
                    </div>
                    <div className={styles.openAction}>
                      <button
                        disabled={!canOpen || opening}
                        onClick={() => {
                          void openRestaurant();
                        }}
                      >
                        {opening
                          ? "Đang mở…"
                          : opened
                            ? "Đang mở"
                            : "Mở nhận đơn"}
                      </button>
                      <small>
                        {opened
                          ? "Trạng thái được tải từ cửa hàng."
                          : restaurant.operating_status === "paused"
                            ? "Chưa hỗ trợ mở từ trạng thái tạm ngừng tại đây."
                            : "Mở nhận đơn cho chính cửa hàng của bạn."}
                      </small>
                    </div>
                  </div>
                  {openState.key === key &&
                    (openState.error || openState.message) && (
                      <p
                        className={
                          openState.error
                            ? styles.openError
                            : styles.openMessage
                        }
                        role={openState.error ? "alert" : "status"}
                      >
                        {openState.error || openState.message}
                      </p>
                    )}
                </section>
                <section>
                  <div className={styles.sectionTitle}>
                    <Zap />
                    <h3>Thiết lập nhanh</h3>
                    <small>
                      Hoàn thiện các thông tin quan trọng để bắt đầu kinh doanh.
                    </small>
                  </div>
                  <div className={styles.setupGrid}>
                    {setup.map(
                      ({ icon: Icon, title, badge, text, action }, index) => (
                        <article className={styles.setupCard} key={title}>
                          <div className={styles.setupHeading}>
                            <span className={styles.icon}>
                              <Icon />
                            </span>
                            <div>
                              <h4>{title}</h4>
                              <span
                                className={
                                  index === 2 && !!restaurant.avatar_url
                                    ? styles.greenBadge
                                    : styles.redBadge
                                }
                              >
                                {badge}
                              </span>
                            </div>
                          </div>
                          {index === 1 && (
                            <small>
                              {"Phương thức thanh toán chưa được xác nhận tại đây"}
                            </small>
                          )}
                          {index === 2 && (
                            <small>
                              <Clock3 size={13} />{" "}
                              {restaurant.location || "Chưa có địa điểm"}
                            </small>
                          )}
                          <p>{text}</p>
                          <button
                            className={styles.primary}
                            onClick={() => unavailable(title)}
                          >
                            {action}
                            <ArrowRight size={16} />
                          </button>
                        </article>
                      ),
                    )}
                    <article className={styles.setupCard}>
                      <div className={styles.setupHeading}>
                        <span className={styles.icon}>
                          <Share2 />
                        </span>
                        <h4>Chia sẻ cửa hàng</h4>
                      </div>
                      <div className={styles.sharePlaceholder}>
                        <Copy size={16} /> {`/restaurants/${restaurant.slug}`}
                      </div>
                      <p>Xem trang cửa hàng của bạn.</p>
                      <Link
                        className={styles.outline}
                        href={`/restaurants/${encodeURIComponent(restaurant.slug)}`}
                      >
                        Xem cửa hàng
                      </Link>
                    </article>
                  </div>
                </section>
                {notice && (
                  <div className={styles.notice} role="status">
                    {notice}
                    <button onClick={() => setNotice("")} aria-label="Đóng">
                      <X size={16} />
                    </button>
                  </div>
                )}
                <section>
                  <div className={styles.sectionTitle}>
                    <BarChart3 />
                    <h3>Tổng quan hôm nay</h3>
                    <small>Chưa có số liệu thống kê tại đây.</small>
                  </div>
                  <div className={styles.stats}>
                    {[
                      { icon: ClipboardList, label: "Đơn mới", value: "—" },
                      {
                        icon: CheckCircle2,
                        label: "Đã chấp nhận",
                        value: "—",
                      },
                      { icon: Check, label: "Hoàn thành", value: "—" },
                      { icon: Wallet, label: "Doanh thu", value: "—" },
                    ].map(({ icon: Icon, label, value }, index) => (
                      <article
                        key={label}
                        className={styles.stat}
                        data-tone={index}
                      >
                        <span className={styles.icon}>
                          <Icon />
                        </span>
                        <div>
                          <h4>{label}</h4>
                          <strong>{value}</strong>
                          <small>Chưa có số liệu</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <section>
                  <div className={styles.sectionTitle}>
                    <ClipboardList />
                    <h3>Đơn hàng mới</h3>
                    <small>Chưa tải danh sách đơn hàng tại đây.</small>
                    <Link href="/seller/orders">
                      Xem tất cả <ArrowRight size={16} />
                    </Link>
                  </div>
                  <div className={styles.empty}>
                    <ClipboardList size={40} />
                    <div>
                      <strong>Chưa có dữ liệu đơn hàng</strong>
                      <p>Mở mục Đơn hàng để xem thêm.</p>
                    </div>
                  </div>
                </section>
              </div>
              <aside className={styles.rail}>
                <section className={styles.card}>
                  <div className={styles.checklistHeading}>
                    <span className={styles.icon}>
                      <ClipboardList />
                    </span>
                    <h3>Việc nên làm tiếp theo</h3>
                    <small>Thiết lập cửa hàng</small>
                  </div>
                  {[
                    ["Thêm món đầu tiên", "Tạo và đăng món ăn đầu tiên"],
                    ["Tải ảnh đại diện", "Giúp cửa hàng của bạn nổi bật hơn"],
                    ["Cấu hình chuyển khoản", "Nhận thanh toán qua ngân hàng"],
                    ["Mở nhận đơn", "Mở nhận đơn cho cửa hàng đang đóng"],
                  ].map(([title, text]) => (
                    <button
                      className={styles.task}
                      key={title}
                      disabled={
                        title === "Mở nhận đơn" && (!canOpen || opening)
                      }
                      onClick={() =>
                        title === "Mở nhận đơn"
                          ? void openRestaurant()
                          : unavailable(title)
                      }
                    >
                      <span
                        className={styles.checkbox}
                        data-done={title === "Mở nhận đơn" && opened}
                      >
                        {title === "Mở nhận đơn" && opened && (
                          <Check size={17} />
                        )}
                      </span>
                      <span>
                        <strong>
                          {title === "Mở nhận đơn" && opened
                            ? "Đã mở nhận đơn"
                            : title}
                        </strong>
                        <small>
                          {title === "Mở nhận đơn" && opening
                            ? "Đang mở…"
                            : text}
                        </small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </section>
                <section className={styles.card}>
                  <div className={styles.sectionTitle}>
                    <Lightbulb />
                    <h3>Cần hỗ trợ?</h3>
                  </div>
                  <p>
                    Nếu bạn có thắc mắc trong quá trình thiết lập hoặc kinh
                    doanh, hãy xem hướng dẫn bên dưới.
                  </p>
                  <button
                    className={styles.outline}
                    onClick={() => setGuideOpen(!guideOpen)}
                    aria-expanded={guideOpen}
                  >
                    Xem hướng dẫn <ArrowRight size={17} />
                  </button>
                  {guideOpen && (
                    <ol className={styles.guide}>
                      <li>Thêm món và đặt giá bán.</li>
                      <li>Hoàn thiện thông tin, hình ảnh cửa hàng.</li>
                      <li>
                        Mở nhận đơn tại thẻ Trạng thái cửa hàng khi bạn sẵn
                        sàng.
                      </li>
                    </ol>
                  )}
                  <button
                    className={styles.support}
                    onClick={() => unavailable("Liên hệ hỗ trợ")}
                  >
                    <Headphones size={18} />
                    Liên hệ hỗ trợ
                  </button>
                </section>
              </aside>
            </div>
          </div>

          {/* Phiên bản Mobile */}
          <div className={styles.mobileView}>
            <header className={styles.mobileHeading}>
              <h1>Seller Dashboard</h1>
              <h2>
                Xin chào, <span>{name}</span> 👋
              </h2>
              <p>
                Cùng hoàn thiện cửa hàng để bắt đầu phục vụ các bạn sinh viên
                nhé!
              </p>
            </header>

            <section
              className={styles.mobileStatusCard}
              aria-labelledby="mobile-store-status-heading"
            >
              <div className={styles.mobileStatusLeft}>
                <h3 id="mobile-store-status-heading">Trạng thái cửa hàng</h3>
                <div className={styles.mobileStatusInfo}>
                  <span className={styles.mobileStoreCircle} aria-hidden="true">
                    <Store size={30} strokeWidth={2} />
                  </span>
                  <div className={styles.mobileStatusCopy}>
                    <span className={styles.mobileClosedPill}>
                      <span
                        className={styles.mobileClosedDot}
                        aria-hidden="true"
                      />
                      {opened
                        ? "Đang mở"
                        : restaurant.operating_status === "paused"
                          ? "Tạm ngừng"
                          : "Tạm đóng"}
                    </span>
                    <p>Trạng thái nhận đơn của cửa hàng.</p>
                  </div>
                </div>
              </div>
              <div className={styles.mobileStatusRight}>
                <span className={styles.mobileOpenButton}>
                  {opening
                    ? "Đang mở…"
                    : opened
                      ? "Đang mở"
                      : "Tạm đóng"}
                </span>
                <small>
                  {opened
                    ? "Trạng thái được tải từ cửa hàng."
                    : "Sử dụng thẻ trạng thái trên máy tính hoặc danh sách công việc để mở nhận đơn."}
                </small>
              </div>
            </section>

            <section
              className={styles.mobileChecklistCard}
              aria-labelledby="mobile-checklist-heading"
            >
              <div className={styles.mobileChecklistTop}>
                <div className={styles.mobileChecklistTitleWrap}>
                  <span
                    className={styles.mobileLightningBadge}
                    aria-hidden="true"
                  >
                    <Zap size={16} fill="currentColor" strokeWidth={2} />
                  </span>
                  <h3 id="mobile-checklist-heading">Hoàn thiện cửa hàng</h3>
                </div>
                <div className={styles.mobileProgressMeta}>
                  <small>{opened ? "1/4 hoàn thành" : "0/4 hoàn thành"}</small>
                  <div
                    className={styles.mobileProgressBar}
                    role="progressbar"
                    aria-label="Tiến độ hoàn thiện cửa hàng"
                    aria-valuenow={opened ? 1 : 0}
                    aria-valuemin={0}
                    aria-valuemax={4}
                  >
                    <span style={{ width: opened ? "25%" : "0%" }} />
                  </div>
                </div>
              </div>
              <p className={styles.mobileChecklistDesc}>
                Hoàn thiện các thông tin quan trọng để bắt đầu kinh doanh.
              </p>
              <div className={styles.mobileChecklistRows}>
                {sellerMobileChecklistItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={styles.mobileChecklistRow}
                  >
                    <span className={styles.mobileRowIcon}>
                      <ChecklistRowIcon kind={item.icon} />
                    </span>
                    <span className={styles.mobileRowText}>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </span>
                    <ChevronRight
                      size={18}
                      className={styles.mobileRowArrow}
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </section>

            <section
              className={styles.mobileTodaySection}
              aria-labelledby="mobile-today-heading"
            >
              <div className={styles.mobileSectionHeader}>
                <div className={styles.mobileSectionTitleLeft}>
                  <BarChart3
                    size={22}
                    strokeWidth={2.4}
                    className={styles.mobileChartIcon}
                    aria-hidden="true"
                  />
                  <h3 id="mobile-today-heading">Tổng quan hôm nay</h3>
                </div>
                <label className={styles.mobileDatePicker}>
                  <CalendarDays
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <select
                    aria-label="Chọn ngày thống kê"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                  >
                    {sellerMobileDateOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
                </label>
              </div>

              <div className={styles.mobileStatsGrid}>
                {sellerMobileTodayStats.map((stat) => (
                  <article key={stat.id} className={styles.mobileStatCard}>
                    <MobileStatIcon tone={stat.tone} />
                    <div className={styles.mobileStatCopy}>
                      <h4>{stat.label}</h4>
                      <strong>{stat.value}</strong>
                      <small>{stat.unit}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section
              className={styles.mobileOrdersSection}
              aria-labelledby="mobile-new-orders-heading"
            >
              <div className={styles.mobileSectionHeader}>
                <div className={styles.mobileSectionTitleLeft}>
                  <span
                    className={styles.mobileOrdersBadgeIcon}
                    aria-hidden="true"
                  >
                    <ClipboardCheck size={16} strokeWidth={2.2} />
                  </span>
                  <h3 id="mobile-new-orders-heading">Đơn hàng mới</h3>
                </div>
                <Link
                  href="/seller/orders"
                  className={styles.mobileSeeAllLink}
                >
                  Xem tất cả
                  <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
                </Link>
              </div>

              <div className={styles.mobileEmptyOrdersCard}>
                <span className={styles.mobileEmptyOrdersIcon} aria-hidden="true">
                  <FileText size={22} strokeWidth={1.8} />
                </span>
                <div className={styles.mobileEmptyOrdersCopy}>
                  <strong>Chưa có đơn hàng nào</strong>
                  <p>
                    Khi cửa hàng bắt đầu nhận đơn, các đơn hàng mới sẽ hiển thị
                    tại đây.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
