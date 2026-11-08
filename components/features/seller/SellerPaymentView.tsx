"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Headphones,
  Info,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import {
  useSellerPreviewStore,
  type SellerPreview,
} from "@/store/useSellerPreviewStore";
import { useSellerShopStore } from "@/store/useSellerShopStore";
import {
  useSellerPaymentStore,
  type SellerPaymentPreview,
} from "@/store/useSellerPaymentStore";
import { demoSellerRestaurant } from "@/lib/mocks/seller-orders.mock";
import { mockRestaurantNumbers } from "@/lib/mocks/catalog.mock";
import { formatOrderCode, formatTransferContent } from "@/lib/orders/order-code";
import TransferContent from "@/components/ui/TransferContent";
import styles from "@/styles/seller-payments.module.css";

export const VIETNAM_BANKS: readonly string[] = [
  "Vietcombank",
  "BIDV",
  "VietinBank",
  "Agribank",
  "Techcombank",
  "MB Bank",
  "ACB",
  "TPBank",
  "VPBank",
  "Sacombank",
  "HDBank",
  "VIB",
  "SHB",
  "MSB",
  "OCB",
  "SeABank",
  "LPBank",
  "Eximbank",
  "Bac A Bank",
  "PVcomBank",
  "ABBank",
  "Nam A Bank",
  "VietBank",
  "VietABank",
  "NCB",
  "BVBank",
  "KienlongBank",
  "Saigonbank",
  "PGBank",
  "BaoVietBank",
  "DongA Bank",
  "Vikki Bank",
  "GPBank",
  "MBV",
  "CBBank",
  "Co-opBank",
  "VBSP",
  "Shinhan Bank",
  "Woori Bank",
  "HSBC",
  "Standard Chartered",
  "UOB",
  "CIMB",
  "Public Bank",
  "Hong Leong Bank",
  "IndovinaBank",
  "VRB",
  "Citibank",
  "Cake by VPBank",
  "Timo",
] as const;

export const DEFAULT_SELLER_TRANSFER_CONTENT =
  "Thanh toán đơn hàng StudentFood";

export function createInitialSellerPaymentPreview(
  draft: SellerPreview | null = null,
): SellerPaymentPreview {
  return {
    cashEnabledPreview: draft?.cash ?? true,
    bankEnabledPreview: draft?.bank ?? true,
    bank_name: "Vietcombank",
    account_no: "0901234567",
    account_name: "NGUYEN VAN A",
    branchPreview: "Chi nhánh Hà Nội",
  };
}

export function validateSellerPaymentForm(
  values: SellerPaymentPreview,
  transferContent: string = DEFAULT_SELLER_TRANSFER_CONTENT,
): string | null {
  const enabledCount =
    Number(values.cashEnabledPreview) + Number(values.bankEnabledPreview);
  if (!enabledCount) {
    return "Cần bật ít nhất một phương thức thanh toán.";
  }
  const bankComplete = Boolean(
    values.bank_name &&
      /^\d{6,19}$/.test(values.account_no.trim()) &&
      values.account_name.trim() &&
      transferContent.trim(),
  );
  if (values.bankEnabledPreview && !bankComplete) {
    return "Nhập ngân hàng, số tài khoản 6–19 chữ số và tên chủ tài khoản.";
  }
  return null;
}

function CashIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect x="2" y="7" width="36" height="26" rx="3" fill="currentColor" />
      <path
        d="M10 11h20a4 4 0 0 0 4 4v10a4 4 0 0 0-4 4H10a4 4 0 0 0-4-4V15a4 4 0 0 0 4-4Z"
        fill="#e5faee"
      />
      <ellipse cx="20" cy="20" rx="6" ry="8" fill="currentColor" />
      <circle cx="10" cy="20" r="1.5" fill="currentColor" />
      <circle cx="30" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
}

function BankIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="m20 2 18 10v4H2v-4L20 2ZM5 34h30v4H5zM8 18h6v14H8zm9 0h6v14h-6zm9 0h6v14h-6z" />
      <circle cx="20" cy="11" r="2" fill="#e9f2ff" />
    </svg>
  );
}

function BankShieldEmblem() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2.25 4.75 5.1v6.15c0 5.05 3.12 9.48 7.25 10.5 4.13-1.02 7.25-5.45 7.25-10.5V5.1L12 2.25Z"
        fill="#0b8a42"
      />
      <path
        d="M12 2.25 4.75 5.1v3.15h14.5V5.1L12 2.25Z"
        fill="#6bc247"
      />
      <path
        d="M8.5 9.2 12 16.4l3.5-7.2h-2.1L12 12.4l-1.4-3.2H8.5Z"
        fill="#ffffff"
      />
    </svg>
  );
}

function FilledInfoIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8.5" fill="#0d6efd" />
      <rect x="9.1" y="8.6" width="1.8" height="6" rx="0.9" fill="#ffffff" />
      <circle cx="10" cy="6" r="1.1" fill="#ffffff" />
    </svg>
  );
}

// Decorative pattern only, deliberately not a payment QR payload.
function PaymentQrIllustration() {
  const finders = [
    [0, 0],
    [22, 0],
    [0, 22],
  ];
  const dots = Array.from({ length: 29 * 29 }, (_, index) => ({
    x: index % 29,
    y: Math.floor(index / 29),
  })).filter(
    ({ x, y }) =>
      !finders.some(
        ([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7,
      ) &&
      !(x >= 11 && x <= 17 && y >= 11 && y <= 17) &&
      (x * 19 + y * 13 + x * y * 7) % 11 < 6,
  );
  return (
    <svg viewBox="-1 -1 31 31" aria-hidden="true" focusable="false">
      <rect x={-1} y={-1} width={31} height={31} fill="white" />
      {dots.map(({ x, y }) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={1}
          height={1}
          fill="#102119"
        />
      ))}
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={7} height={7} fill="#102119" />
          <rect x={x + 1} y={y + 1} width={5} height={5} fill="white" />
          <rect x={x + 2} y={y + 2} width={3} height={3} fill="#102119" />
        </g>
      ))}
      <rect x={11} y={11} width={7} height={7} rx={1} fill="#e2f4e9" />
      <path
        d="M12.5 12.5 14.5 12 16.5 12.5v2c0 1.3-1 2.2-2 3-1-.8-2-1.7-2-3Z"
        fill="#048552"
      />
    </svg>
  );
}

export default function SellerPaymentView() {
  const saved = useSellerPaymentStore((state) => state.saved);
  const shopName = useSellerShopStore((state) => state.shop?.name);
  const draft = useSellerPreviewStore((state) => state.draft);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.resolve(useSellerPreviewStore.persist.rehydrate()).then(() => {
      if (!mounted) return;
      useSellerPaymentStore
        .getState()
        .initialize(useSellerPreviewStore.getState().draft);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const name = shopName || draft?.name || demoSellerRestaurant.name;
  const effectivePayment = saved ?? createInitialSellerPaymentPreview(draft);

  return (
    <div className={styles.page}>
      <StudentHeader variant="seller" />
      <div className={styles.workspace}>
        <SellerSidebar active="payments" name={name} />
        <PaymentForm
          key={ready ? "ready" : "initial"}
          initial={effectivePayment}
          shopName={name}
        />
      </div>
    </div>
  );
}

function PaymentForm({
  initial,
  shopName,
}: {
  initial: SellerPaymentPreview;
  shopName: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [defaultTransferText, setDefaultTransferText] = useState(
    DEFAULT_SELLER_TRANSFER_CONTENT,
  );
  const [savedTransferText, setSavedTransferText] = useState(
    DEFAULT_SELLER_TRANSFER_CONTENT,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [guide, setGuide] = useState(false);
  const [showMobileQrModal, setShowMobileQrModal] = useState(false);

  const savePreview = useSellerPaymentStore((state) => state.save);
  const cash = values.cashEnabledPreview;
  const transfer = values.bankEnabledPreview;

  // Sample code only; each actual checkout supplies its own server-allocated code.
  const transferContent = formatTransferContent(
    formatOrderCode(mockRestaurantNumbers[demoSellerRestaurant.id], 1),
    shopName,
  );
  const bankComplete = Boolean(
    values.bank_name &&
      /^\d{6,19}$/.test(values.account_no.trim()) &&
      values.account_name.trim(),
  );
  const enabledCount = Number(cash) + Number(transfer);
  const configured = !transfer || bankComplete;
  const bankOptions = [
    ...new Set([...VIETNAM_BANKS, values.bank_name].filter(Boolean)),
  ];

  function field<K extends keyof SellerPaymentPreview>(
    key: K,
    value: SellerPaymentPreview[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateSellerPaymentForm(
      values,
      defaultTransferText,
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    const cleaned = {
      ...values,
      account_no: values.account_no.trim(),
      account_name: values.account_name.trim().toUpperCase(),
      branchPreview: values.branchPreview.trim(),
    };
    savePreview(cleaned);
    setValues(cleaned);
    setSavedTransferText(
      defaultTransferText.trim() || DEFAULT_SELLER_TRANSFER_CONTENT,
    );
    setDefaultTransferText(
      defaultTransferText.trim() || DEFAULT_SELLER_TRANSFER_CONTENT,
    );
    const draft = useSellerPreviewStore.getState().draft;
    if (draft) {
      useSellerPreviewStore
        .getState()
        .registerPreview({ ...draft, cash, bank: transfer });
    }
    setError("");
    setNotice(
      "Đã lưu cài đặt trong demo frontend. Chưa ghi DB hoặc xác minh tài khoản ngân hàng.",
    );
  }

  function cancel() {
    const saved = useSellerPaymentStore.getState().saved ?? initial;
    setValues(saved);
    setDefaultTransferText(savedTransferText);
    setError("");
    setNotice("Đã khôi phục cài đặt được lưu gần nhất trong bản demo.");
  }

  const checks = [
    {
      title: cash ? "Tiền mặt đã được bật" : "Tiền mặt đang tắt",
      text: cash
        ? "Phương thức thanh toán tiền mặt đang hoạt động."
        : "Khách không thể chọn tiền mặt trong cấu hình này.",
      done: cash,
    },
    {
      title: transfer ? "Chuyển khoản đã được bật" : "Chuyển khoản đang tắt",
      text: transfer
        ? "Phương thức chuyển khoản đang hoạt động."
        : "Khách không thể chọn chuyển khoản trong cấu hình này.",
      done: transfer,
    },
    {
      title: bankComplete
        ? "Thông tin ngân hàng đã đầy đủ"
        : "Thông tin ngân hàng chưa đầy đủ",
      text: bankComplete
        ? "Đã cung cấp đầy đủ thông tin tài khoản."
        : "Bổ sung các trường bắt buộc nếu dùng chuyển khoản.",
      done: bankComplete,
    },
    {
      title:
        enabledCount && configured
          ? "Sẵn sàng nhận thanh toán"
          : "Chưa sẵn sàng nhận thanh toán",
      text: "Trạng thái xem trước, chưa áp dụng trên hệ thống.",
      done: Boolean(enabledCount && configured),
    },
  ];

  return (
    <main className={styles.main}>
      {/* Phiên bản Desktop giữ nguyên 100% */}
      <div className={styles.desktopView}>
        <header className={styles.heading}>
          <h1>Thanh toán</h1>
          <p>
            Cài đặt phương thức thanh toán và thông tin tài khoản ngân hàng để
            nhận tiền từ sinh viên.
          </p>
        </header>
        <div className={styles.stats}>
          <article className={styles.card}>
            <span className={styles.statIcon} data-tone="blue">
              <Wallet size={29} />
            </span>
            <div>
              <h3>Phương thức đang bật</h3>
              <strong className={styles.count}>{enabledCount}</strong>
              <p>Tổng số phương thức thanh toán hiện đang hoạt động</p>
            </div>
          </article>
          <article className={styles.card}>
            <span className={styles.statIcon} data-tone="green">
              <CashIcon size={40} />
            </span>
            <div>
              <h3>Tiền mặt</h3>
              <span className={styles.badge} data-on={cash}>
                ● {cash ? "Đã bật" : "Đang tắt"}
              </span>
              <p>Khách hàng thanh toán khi nhận món.</p>
            </div>
          </article>
          <article className={styles.card}>
            <span className={styles.statIcon} data-tone="blue">
              <BankIcon size={40} />
            </span>
            <div>
              <div className={styles.statTitle}>
                <h3>Chuyển khoản</h3>
                <span className={styles.badge} data-on={bankComplete}>
                  ● {bankComplete ? "Đã cấu hình" : "Chưa cấu hình"}
                </span>
              </div>
              <p>
                {bankComplete
                  ? "Đã thiết lập thông tin ngân hàng nhận thanh toán."
                  : "Bổ sung thông tin ngân hàng nhận thanh toán."}
              </p>
            </div>
          </article>
        </div>
        {(error || notice) && (
          <p
            className={error ? styles.error : styles.notice}
            role={error ? "alert" : "status"}
          >
            {error || notice}
          </p>
        )}
        <form onSubmit={save} className={styles.content} noValidate>
          <div className={styles.left}>
            <section className={styles.card}>
              <h2>Phương thức thanh toán</h2>
              <div className={styles.methods}>
                {[
                  {
                    key: "cashEnabledPreview" as const,
                    title: "Tiền mặt",
                    text: "Khách hàng thanh toán khi nhận món.",
                    enabled: cash,
                    icon: CashIcon,
                    tone: "green",
                  },
                  {
                    key: "bankEnabledPreview" as const,
                    title: "Chuyển khoản",
                    text: "Khách hàng chuyển khoản trước hoặc theo hướng dẫn của cửa hàng.",
                    enabled: transfer,
                    icon: BankIcon,
                    tone: "blue",
                  },
                ].map(({ key, title, text, enabled, icon: Icon, tone }) => (
                  <article
                    key={key}
                    className={styles.method}
                    data-enabled={enabled}
                  >
                    <span className={styles.methodIcon} data-tone={tone}>
                      <Icon size={43} />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                      <span className={styles.badge} data-on={enabled}>
                        ● {enabled ? "Đang bật" : "Đang tắt"}
                      </span>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={`Bật ${title}`}
                        checked={enabled}
                        onChange={(event) => field(key, event.target.checked)}
                      />
                    </label>
                  </article>
                ))}
              </div>
              <p className={styles.info}>
                <Info size={17} />
                Bạn có thể bật một hoặc cả hai phương thức thanh toán tùy theo
                nhu cầu kinh doanh của cửa hàng.
              </p>
            </section>
            <div className={styles.bankColumns}>
              <section className={styles.card}>
                <h2>Thông tin chuyển khoản</h2>
                <p className={styles.subtitle}>
                  Thông tin này sẽ được sử dụng để tạo mã QR chuyển khoản cho
                  sinh viên.
                </p>
                <div className={styles.bankFields}>
                  <label>
                    Ngân hàng <b>*</b>
                    <div className={styles.bankSelect}>
                      <ShieldCheck size={23} aria-hidden="true" />
                      <select
                        value={values.bank_name}
                        onChange={(event) =>
                          field("bank_name", event.target.value)
                        }
                      >
                        <option value="">Chọn ngân hàng</option>
                        {bankOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                  <label>
                    Số tài khoản <b>*</b>
                    <input
                      inputMode="numeric"
                      maxLength={19}
                      value={values.account_no}
                      onChange={(event) =>
                        field("account_no", event.target.value)
                      }
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Tên chủ tài khoản <b>*</b>
                    <input
                      maxLength={100}
                      value={values.account_name}
                      onChange={(event) =>
                        field("account_name", event.target.value)
                      }
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Chi nhánh <span>(tùy chọn)</span>
                    <input
                      maxLength={120}
                      value={values.branchPreview}
                      onChange={(event) =>
                        field("branchPreview", event.target.value)
                      }
                    />
                  </label>
                  <div className={styles.full}>
                    <TransferContent value={transferContent} variant="field" />
                    <small>
                      Nội dung được tạo tự động từ mã đơn và tên quán, thay đổi
                      theo từng đơn hàng.
                    </small>
                  </div>
                </div>
              </section>
              <section className={`${styles.card} ${styles.qrCard}`}>
                <h3>Xem trước QR thanh toán</h3>
                <div className={styles.qrPreview}>
                  <strong className={styles.qrBrand}>
                    <span>Viet</span>QR <small>DEMO</small>
                  </strong>
                  <div
                    className={styles.qrImage}
                    role="img"
                    aria-label="Hình minh họa QR, không dùng để thanh toán"
                  >
                    <PaymentQrIllustration />
                  </div>
                  <strong>{shopName}</strong>
                  <span>{values.bank_name || "Chưa chọn ngân hàng"}</span>
                  <span>{values.account_no || "Chưa có số tài khoản"}</span>
                  <span>
                    {values.account_name || "Chưa có tên chủ tài khoản"}
                  </span>
                  <strong className={styles.amount}>45.000đ</strong>
                  <small>Nội dung: {transferContent}</small>
                  <small>(Mã đơn và số tiền mẫu, không phải đơn hàng thật)</small>
                </div>
                <p className={styles.info}>
                  <Info size={16} />
                  QR thật sẽ được tạo theo từng đơn khi nối API.
                </p>
              </section>
            </div>
          </div>
          <aside className={styles.right}>
            <section className={styles.card}>
              <h2>Trạng thái cấu hình</h2>
              <div className={styles.checks}>
                {checks.map((entry) => (
                  <article key={entry.title}>
                    <span data-done={entry.done}>
                      {entry.done ? <Check size={23} /> : <Info size={23} />}
                    </span>
                    <div>
                      <h3>{entry.title}</h3>
                      <p>{entry.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className={styles.card}>
              <div className={styles.supportHeading}>
                <span>
                  <Headphones size={31} />
                </span>
                <div>
                  <h2>Cần hỗ trợ?</h2>
                  <p>
                    Đội ngũ StudentFood luôn sẵn sàng hỗ trợ bạn trong quá trình
                    cài đặt thanh toán.
                  </p>
                </div>
              </div>
              <div className={styles.supportActions}>
                <button
                  type="button"
                  className={styles.outline}
                  onClick={() => setGuide(true)}
                >
                  <FileText size={18} />
                  Xem hướng dẫn
                </button>
                <button
                  type="button"
                  className={styles.outline}
                  onClick={() => {
                    setError("");
                    setNotice(
                      "Kênh liên hệ hỗ trợ chưa được cấu hình trong bản demo.",
                    );
                  }}
                >
                  <MessageCircle size={18} />
                  Liên hệ hỗ trợ
                </button>
              </div>
            </section>
            <footer className={styles.actions}>
              <button type="button" className={styles.outline} onClick={cancel}>
                Hủy thay đổi
              </button>
              <button type="submit" className={styles.primary}>
                Lưu thay đổi
              </button>
            </footer>
          </aside>
        </form>
        {guide && (
          <section
            className={styles.guide}
            aria-label="Hướng dẫn cài đặt thanh toán"
          >
            <button
              type="button"
              onClick={() => setGuide(false)}
              aria-label="Đóng hướng dẫn"
            >
              <X size={18} />
            </button>
            <h3>Hướng dẫn cài đặt</h3>
            <p>
              Bật ít nhất một phương thức. Nếu bật chuyển khoản, nhập ngân hàng,
              số tài khoản và tên chủ tài khoản, rồi bấm Lưu thay đổi. Nội dung
              chuyển khoản tự tạo theo từng đơn. Hủy thay đổi khôi phục lần lưu
              gần nhất.
            </p>
          </section>
        )}
      </div>

      {/* Phiên bản Mobile trùng khớp 100% với ảnh mẫu */}
      <div className={styles.mobileView} data-testid="seller-payment-mobile">
        <header className={styles.mobileTopBar}>
          <button
            type="button"
            className={styles.mobileBackBtn}
            onClick={() => router.push("/seller/shop")}
            aria-label="Quay lại Cửa hàng"
          >
            <ChevronLeft size={25} strokeWidth={2.3} aria-hidden="true" />
          </button>
          <h1 className={styles.mobileTopTitle}>Thanh toán</h1>
          <span className={styles.mobileTopSpacer} aria-hidden="true" />
        </header>

        <form
          onSubmit={save}
          className={styles.mobileForm}
          noValidate
          data-testid="seller-payment-mobile-form"
        >
          <p className={styles.mobileIntro}>
            Cài đặt phương thức nhận tiền của cửa hàng.
          </p>

          {(error || notice) && (
            <div
              className={error ? styles.mobileError : styles.mobileNotice}
              role={error ? "alert" : "status"}
            >
              <span>{error || notice}</span>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Card 1: Phương thức thanh toán */}
          <section
            className={styles.mobileCard}
            aria-labelledby="mobile-payment-methods-heading"
          >
            <h2
              id="mobile-payment-methods-heading"
              className={styles.mobileCardTitle}
            >
              Phương thức thanh toán
            </h2>

            <div className={styles.mobileMethodList}>
              <div className={styles.mobileMethodRow}>
                <span
                  className={styles.mobileMethodIcon}
                  data-tone="green"
                  aria-hidden="true"
                >
                  <CashIcon size={28} />
                </span>
                <div className={styles.mobileMethodCopy}>
                  <strong>Tiền mặt</strong>
                  <span>Khách thanh toán khi nhận món.</span>
                </div>
                <label className={styles.mobileSwitch}>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label="Bật Tiền mặt"
                    checked={cash}
                    onChange={(event) =>
                      field("cashEnabledPreview", event.target.checked)
                    }
                  />
                </label>
              </div>

              <div className={styles.mobileMethodRow}>
                <span
                  className={styles.mobileMethodIcon}
                  data-tone="blue"
                  aria-hidden="true"
                >
                  <BankIcon size={26} />
                </span>
                <div className={styles.mobileMethodCopy}>
                  <strong>Chuyển khoản</strong>
                  <span>Nhận tiền qua tài khoản ngân hàng.</span>
                </div>
                <label className={styles.mobileSwitch}>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label="Bật Chuyển khoản"
                    checked={transfer}
                    onChange={(event) =>
                      field("bankEnabledPreview", event.target.checked)
                    }
                  />
                </label>
              </div>
            </div>

            <p className={styles.mobileMethodFootnote}>
              <FilledInfoIcon size={18} />
              <span>Bạn có thể bật một hoặc cả hai phương thức.</span>
            </p>
          </section>

          {/* Card 2: Thông tin ngân hàng */}
          <section
            className={styles.mobileCard}
            aria-labelledby="mobile-bank-info-heading"
          >
            <h2
              id="mobile-bank-info-heading"
              className={styles.mobileCardTitle}
            >
              Thông tin ngân hàng
            </h2>
            <p className={styles.mobileCardSubtitle}>
              Dùng để tạo mã QR thanh toán cho từng đơn.
            </p>

            <div className={styles.mobileFieldStack}>
              <label className={styles.mobileFieldLabel}>
                <span className={styles.mobileLabelText}>
                  Ngân hàng <b>*</b>
                </span>
                <div className={styles.mobileSelectWrap}>
                  <span className={styles.mobileBankEmblem} aria-hidden="true">
                    <BankShieldEmblem />
                  </span>
                  <select
                    aria-label="Ngân hàng"
                    value={values.bank_name}
                    onChange={(event) =>
                      field("bank_name", event.target.value)
                    }
                    className={styles.mobileSelect}
                  >
                    {bankOptions.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={18}
                    strokeWidth={2.2}
                    className={styles.mobileSelectChevron}
                    aria-hidden="true"
                  />
                </div>
              </label>

              <label className={styles.mobileFieldLabel}>
                <span className={styles.mobileLabelText}>
                  Số tài khoản <b>*</b>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={19}
                  value={values.account_no}
                  onChange={(event) => field("account_no", event.target.value)}
                  autoComplete="off"
                  className={styles.mobileInput}
                />
              </label>

              <label className={styles.mobileFieldLabel}>
                <span className={styles.mobileLabelText}>
                  Tên chủ tài khoản <b>*</b>
                </span>
                <input
                  type="text"
                  maxLength={100}
                  value={values.account_name}
                  onChange={(event) =>
                    field("account_name", event.target.value)
                  }
                  autoComplete="off"
                  className={styles.mobileInput}
                />
              </label>

              <label className={styles.mobileFieldLabel}>
                <span className={styles.mobileLabelText}>
                  Chi nhánh{" "}
                  <span className={styles.mobileOptionalTag}>
                    (không bắt buộc)
                  </span>
                </span>
                <input
                  type="text"
                  maxLength={120}
                  value={values.branchPreview}
                  onChange={(event) =>
                    field("branchPreview", event.target.value)
                  }
                  className={styles.mobileInput}
                />
              </label>

              <label className={styles.mobileFieldLabel}>
                <span className={styles.mobileLabelText}>
                  Nội dung chuyển khoản mặc định <b>*</b>
                </span>
                <input
                  type="text"
                  maxLength={140}
                  value={defaultTransferText}
                  onChange={(event) => {
                    setDefaultTransferText(event.target.value);
                    setError("");
                    setNotice("");
                  }}
                  className={styles.mobileInput}
                />
                <small className={styles.mobileFieldHint}>
                  Nội dung chuyển khoản có thể thay đổi theo từng đơn.
                </small>
              </label>
            </div>
          </section>

          {/* Card 3: Xem trước mã QR */}
          <button
            type="button"
            className={styles.mobileQrPreviewCard}
            onClick={() => setShowMobileQrModal(true)}
            data-testid="seller-payment-qr-preview-trigger"
          >
            <span className={styles.mobileQrPreviewIcon} aria-hidden="true">
              <QrCode size={24} strokeWidth={2.1} />
            </span>
            <span className={styles.mobileQrPreviewText}>
              <strong>Xem trước mã QR</strong>
              <span>QR được tạo theo thông tin ngân hàng.</span>
            </span>
            <ChevronRight
              size={20}
              strokeWidth={2.1}
              className={styles.mobileQrPreviewArrow}
              aria-hidden="true"
            />
          </button>

          {/* Link hướng dẫn thiết lập thanh toán */}
          <button
            type="button"
            className={styles.mobileGuideLink}
            onClick={() => setGuide(true)}
          >
            <FilledInfoIcon size={18} />
            <span>Hướng dẫn thiết lập thanh toán</span>
          </button>

          {/* Thanh nút hành động cố định dưới cùng */}
          <footer
            className={styles.mobileBottomBar}
            data-testid="seller-payment-mobile-actions"
          >
            <div className={styles.mobileBottomInner}>
              <button
                type="button"
                className={styles.mobileCancelBtn}
                onClick={cancel}
              >
                Hủy thay đổi
              </button>
              <button type="submit" className={styles.mobileSaveBtn}>
                Lưu thay đổi
              </button>
            </div>
          </footer>
        </form>

        {/* Modal Xem trước mã QR trên Mobile */}
        {showMobileQrModal && (
          <div
            className={styles.mobileModalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-qr-preview-title"
            onClick={() => setShowMobileQrModal(false)}
          >
            <div
              className={styles.mobileModalCard}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.mobileModalHeader}>
                <h3 id="mobile-qr-preview-title">Xem trước mã QR</h3>
                <button
                  type="button"
                  aria-label="Đóng"
                  onClick={() => setShowMobileQrModal(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <div className={styles.qrPreview}>
                <strong className={styles.qrBrand}>
                  <span>Viet</span>QR <small>DEMO</small>
                </strong>
                <div
                  className={styles.qrImage}
                  role="img"
                  aria-label="Hình minh họa QR, không dùng để thanh toán"
                >
                  <PaymentQrIllustration />
                </div>
                <strong>{shopName}</strong>
                <span>{values.bank_name || "Chưa chọn ngân hàng"}</span>
                <span>{values.account_no || "Chưa có số tài khoản"}</span>
                <span>
                  {values.account_name || "Chưa có tên chủ tài khoản"}
                </span>
                <strong className={styles.amount}>45.000đ</strong>
                <small>
                  Nội dung:{" "}
                  {defaultTransferText.trim() ||
                    DEFAULT_SELLER_TRANSFER_CONTENT}
                </small>
              </div>
            </div>
          </div>
        )}

        {/* Modal Hướng dẫn thiết lập thanh toán trên Mobile */}
        {guide && (
          <div
            className={styles.mobileModalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-payment-guide-title"
            onClick={() => setGuide(false)}
          >
            <div
              className={styles.mobileModalCard}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.mobileModalHeader}>
                <h3 id="mobile-payment-guide-title">
                  Hướng dẫn thiết lập thanh toán
                </h3>
                <button
                  type="button"
                  aria-label="Đóng hướng dẫn"
                  onClick={() => setGuide(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <p className={styles.mobileModalBody}>
                Bật ít nhất một phương thức thanh toán. Nếu bật chuyển khoản,
                hãy chọn ngân hàng, nhập số tài khoản, tên chủ tài khoản và nội
                dung chuyển khoản mặc định, sau đó bấm Lưu thay đổi để tạo mã
                QR thanh toán tự động cho người mua.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
