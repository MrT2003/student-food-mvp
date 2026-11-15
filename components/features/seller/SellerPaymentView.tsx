"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
import { useSellerAccess } from "./SellerAccessProvider";
import { useAuthStore } from "@/store/useAuthStore";
import { readSellerBanks, saveSellerBank } from "@/lib/seller/management-client";
import type { SellerPreview } from "@/store/useSellerPreviewStore";
import type { SellerPaymentPreview } from "@/store/useSellerPaymentStore";
import type {
  SellerBankCreate,
  SellerBankPatch,
  SellerBankResult,
} from "@/types/seller.types";
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

const POPULAR_BANKS = [
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
  "VIB",
  "HDBank",
  "SHB",
  "MSB",
  "OCB",
  "SeABank",
  "LPBank",
  "Eximbank",
  "Nam A Bank",
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
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="2" y="7" width="36" height="26" rx="3" fill="currentColor" />
      <path d="M10 11h20a4 4 0 0 0 4 4v10a4 4 0 0 0-4 4H10a4 4 0 0 0-4-4V15a4 4 0 0 0 4-4Z" fill="#e5faee" />
      <ellipse cx="20" cy="20" rx="6" ry="8" fill="currentColor" />
      <circle cx="10" cy="20" r="1.5" fill="currentColor" />
      <circle cx="30" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
}

function BankIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="currentColor" aria-hidden="true">
      <path d="m20 2 18 10v4H2v-4L20 2ZM5 34h30v4H5zM8 18h6v14H8zm9 0h6v14h-6zm9 0h6v14h-6z" />
      <circle cx="20" cy="11" r="2" fill="#e9f2ff" />
    </svg>
  );
}

function BankShieldEmblem() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.25 4.75 5.1v6.15c0 5.05 3.12 9.48 7.25 10.5 4.13-1.02 7.25-5.45 7.25-10.5V5.1L12 2.25Z"
        fill="#0b8a42"
      />
      <path d="M12 2.25 4.75 5.1v3.15h14.5V5.1L12 2.25Z" fill="#6bc247" />
      <path d="M8.5 9.2 12 16.4l3.5-7.2h-2.1L12 12.4l-1.4-3.2H8.5Z" fill="#ffffff" />
    </svg>
  );
}

function FilledInfoIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8.5" fill="#0d6efd" />
      <rect x="9.1" y="8.6" width="1.8" height="6" rx="0.9" fill="#ffffff" />
      <circle cx="10" cy="6" r="1.1" fill="#ffffff" />
    </svg>
  );
}

function PaymentQrIllustration() {
  const finders = [[0, 0], [22, 0], [0, 22]];
  const dots = Array.from({ length: 29 * 29 }, (_, index) => ({ x: index % 29, y: Math.floor(index / 29) }))
    .filter(({ x, y }) =>
      !finders.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7) &&
      !(x >= 11 && x <= 17 && y >= 11 && y <= 17) &&
      ((x * 19 + y * 13 + x * y * 7) % 11 < 6)
    );
  return (
    <svg viewBox="-1 -1 31 31" aria-hidden="true" focusable="false">
      <rect x={-1} y={-1} width={31} height={31} fill="white" />
      {dots.map(({ x, y }) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#102119" />)}
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={7} height={7} fill="#102119" />
          <rect x={x + 1} y={y + 1} width={5} height={5} fill="white" />
          <rect x={x + 2} y={y + 2} width={3} height={3} fill="#102119" />
        </g>
      ))}
      <rect x={11} y={11} width={7} height={7} rx={1} fill="#e2f4e9" />
      <path d="M12.5 12.5 14.5 12 16.5 12.5v2c0 1.3-1 2.2-2 3-1-.8-2-1.7-2-3Z" fill="#048552" />
    </svg>
  );
}

type Bank = SellerBankResult["bank"];
const blank = (): SellerBankCreate => ({
  bank_name: "",
  account_no: "",
  account_name: "",
  is_default: false,
});

export default function SellerPaymentView() {
  const { data, error, retry } = useSellerAccess();
  return (
    <div className={styles.page}>
      <StudentHeader variant="seller" />
      <div className={styles.workspace}>
        <SellerSidebar active="payments" name={data?.restaurant?.name ?? ""} />
        {data?.restaurant ? (
          <BankManager
            key={`${data.user.id}:${data.restaurant.id}`}
            actorId={data.user.id}
            restaurantId={data.restaurant.id}
            shopName={data.restaurant.name}
          />
        ) : (
          <main className={styles.card}>
            {error || "Đang tải cửa hàng…"}
            {error && <button onClick={retry}>Thử lại</button>}
          </main>
        )}
      </div>
    </div>
  );
}

export function BankManager({
  actorId,
  restaurantId,
  shopName = "Cửa hàng của bạn",
}: {
  actorId: string;
  restaurantId: string;
  shopName?: string;
}) {
  // Không dùng preview/persist store: dữ liệu chỉ thuộc instance user + quán hiện tại.
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [values, setValues] = useState(blank);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cashEnabled, setCashEnabled] = useState(true);
  const [bankEnabled, setBankEnabled] = useState(true);
  const [guide, setGuide] = useState(false);
  const [showMobileQrModal, setShowMobileQrModal] = useState(false);
  const pending = useRef(false), mounted = useRef(true), generation = useRef(0);
  const current = useCallback(() => mounted.current && useAuthStore.getState().user?.id === actorId, [actorId]);
  const cancel = useCallback(() => { generation.current++; }, []);

  const reload = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true);
    try {
      const result = await readSellerBanks(actorId, restaurantId);
      if (current() && run === generation.current) {
        setBanks(result.banks);
        setError("");
      }
    } catch (err) {
      if (current() && run === generation.current) {
        setBanks(null);
        setError(err instanceof Error ? err.message : "Không tải được ngân hàng.");
      }
    } finally {
      if (current() && run === generation.current) setLoading(false);
    }
  }, [actorId, restaurantId, current]);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => {
      if (mounted.current) void reload();
    });
    return () => {
      mounted.current = false;
      cancel();
    };
    // Component được key theo actorId/restaurantId; không tái dùng cache giữa user.
  }, [reload, cancel]);

  function edit(bank: Bank | null) {
    if (pending.current) return;
    setEditing(bank);
    setValues(
      bank
        ? {
            bank_name: bank.bank_name,
            account_no: bank.account_no,
            account_name: bank.account_name,
            is_default: bank.is_default,
          }
        : blank(),
    );
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || banks === null) return;
    const payload: SellerBankPatch = {};
    for (const field of ["bank_name", "account_no", "account_name"] as const) {
      if (!editing || values[field] !== editing[field]) {
        if (!values[field].trim()) {
          setError("Nhập ngân hàng, số tài khoản và tên chủ tài khoản.");
          return;
        }
        payload[field] = values[field];
      }
    }
    if (!editing || values.is_default !== editing.is_default) payload.is_default = values.is_default;
    if (!Object.keys(payload).length) {
      setNotice("Không có thay đổi để lưu.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await saveSellerBank(actorId, restaurantId, editing?.id ?? null, payload);
      if (!current()) return;
      setNotice("Đã lưu tài khoản ngân hàng thành công.");
      setEditing(null);
      setValues(blank());
      await reload(); // Đọc lại nguồn DB; không tự mô phỏng bỏ default cũ.
    } catch (err) {
      if (current()) setError(err instanceof Error ? err.message : "Không lưu được ngân hàng.");
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  }

  const otherDefault = banks?.some((bank) => bank.is_default && bank.id !== editing?.id);
  const activeBank = editing ?? banks?.find((b) => b.is_default) ?? banks?.[0] ?? null;
  const previewBankName = values.bank_name.trim() || activeBank?.bank_name || "";
  const previewAccountNo = values.account_no.trim() || activeBank?.account_no || "";
  const previewAccountName = values.account_name.trim() || activeBank?.account_name || "";
  const hasSavedOrDraftBank = Boolean(
    (banks && banks.length > 0) ||
      (values.bank_name.trim() && values.account_no.trim() && values.account_name.trim()),
  );
  const enabledCount = Number(cashEnabled) + Number(bankEnabled);
  const configured = enabledCount > 0 && (!bankEnabled || hasSavedOrDraftBank);
  const transferContent = `SF-01-0001 - ${shopName}`;
  const bankOptions = [...new Set([...POPULAR_BANKS, values.bank_name].filter(Boolean))];

  const checks = [
    {
      title: "Phương thức thanh toán",
      text:
        enabledCount === 2
          ? "Đã bật Tiền mặt và Chuyển khoản"
          : cashEnabled
            ? "Đã bật Tiền mặt khi nhận hàng"
            : bankEnabled
              ? "Đã bật Chuyển khoản ngân hàng"
              : "Chưa bật phương thức nào",
      done: enabledCount > 0,
    },
    {
      title: "Tài khoản ngân hàng",
      text:
        banks && banks.length > 0
          ? `Đã lưu ${banks.length} tài khoản (${(banks.find((b) => b.is_default) ?? banks[0]).bank_name})`
          : "Chưa lưu tài khoản ngân hàng",
      done: Boolean(banks && banks.length > 0),
    },
    {
      title: "Mã QR chuyển khoản",
      text: hasSavedOrDraftBank
        ? "Sẵn sàng hiển thị thông tin chuyển khoản cho sinh viên"
        : "Nhập thông tin ngân hàng để tạo QR",
      done: hasSavedOrDraftBank,
    },
  ];

  return (
    <main className={styles.main}>
      {/* Phiên bản Desktop */}
      <div className={styles.desktopView}>
        <header className={styles.heading}>
          <div>
            <h1>Thanh toán</h1>
            <p>Thiết lập phương thức thanh toán và tài khoản nhận tiền cho cửa hàng của bạn.</p>
          </div>
        </header>

        <section className={styles.stats} aria-label="Tóm tắt cấu hình thanh toán">
          <article className={styles.card}>
            <span className={styles.statIcon} data-tone="blue">
              <Wallet size={32} />
            </span>
            <div>
              <div className={styles.statTitle}>
                <h3>Phương thức đang bật</h3>
                <span className={styles.badge} data-on={enabledCount > 0}>
                  ● {enabledCount > 0 ? "Đang hoạt động" : "Chưa bật"}
                </span>
              </div>
              <strong className={styles.count}>{enabledCount}/2</strong>
              <p>Tiền mặt và Chuyển khoản ngân hàng</p>
            </div>
          </article>

          <article className={styles.card}>
            <span className={styles.statIcon} data-tone="blue">
              <BankIcon size={34} />
            </span>
            <div>
              <div className={styles.statTitle}>
                <h3>Chuyển khoản ngân hàng</h3>
                <span className={styles.badge} data-on={bankEnabled && hasSavedOrDraftBank}>
                  ● {bankEnabled ? (hasSavedOrDraftBank ? "Đã cấu hình" : "Chưa có STK") : "Đang tắt"}
                </span>
              </div>
              <p>
                {previewBankName && previewAccountNo
                  ? `${previewBankName} · ${previewAccountNo}`
                  : "Thêm tài khoản ngân hàng để nhận tiền chuyển khoản từ sinh viên"}
              </p>
            </div>
          </article>

          <article className={styles.card}>
            <span className={styles.statIcon} data-tone="green">
              <ShieldCheck size={34} />
            </span>
            <div>
              <div className={styles.statTitle}>
                <h3>Trạng thái cấu hình</h3>
                <span className={styles.badge} data-on={configured}>
                  ● {configured ? "Sẵn sàng nhận tiền" : "Chưa hoàn tất"}
                </span>
              </div>
              <p>
                {configured
                  ? "Cửa hàng đã sẵn sàng nhận thanh toán từ đơn hàng của sinh viên"
                  : "Vui lòng bật phương thức thanh toán và lưu tài khoản ngân hàng"}
              </p>
            </div>
          </article>
        </section>

        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}

        <div className={styles.content}>
          <div className={styles.left}>
            <section className={styles.card}>
              <h2>Phương thức thanh toán</h2>
              <div className={styles.methods}>
                <article className={styles.method} data-enabled={cashEnabled}>
                  <span className={styles.methodIcon} data-tone="green">
                    <CashIcon size={38} />
                  </span>
                  <div>
                    <h3>Tiền mặt khi nhận hàng</h3>
                    <p>Sinh viên thanh toán trực tiếp bằng tiền mặt khi nhận đồ ăn.</p>
                    <span className={styles.badge} data-on={cashEnabled}>
                      ● {cashEnabled ? "Đang bật" : "Đang tắt"}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={cashEnabled}
                    aria-label="Bật Tiền mặt khi nhận hàng"
                    onClick={() => setCashEnabled((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 16,
                      top: 18,
                      width: 42,
                      height: 24,
                      borderRadius: 20,
                      border: 0,
                      padding: 3,
                      background: cashEnabled ? "linear-gradient(110deg,#ff8b23,#ff5721)" : "#b9c4d2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: cashEnabled ? "flex-end" : "flex-start",
                    }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", display: "block" }} />
                  </button>
                </article>

                <article className={styles.method} data-enabled={bankEnabled}>
                  <span className={styles.methodIcon} data-tone="blue">
                    <BankIcon size={38} />
                  </span>
                  <div>
                    <h3>Chuyển khoản ngân hàng</h3>
                    <p>Sinh viên chuyển khoản qua mã QR hoặc số tài khoản ngân hàng của quán.</p>
                    <span className={styles.badge} data-on={bankEnabled}>
                      ● {bankEnabled ? "Đang bật" : "Đang tắt"}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bankEnabled}
                    aria-label="Bật Chuyển khoản ngân hàng"
                    onClick={() => setBankEnabled((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 16,
                      top: 18,
                      width: 42,
                      height: 24,
                      borderRadius: 20,
                      border: 0,
                      padding: 3,
                      background: bankEnabled ? "linear-gradient(110deg,#ff8b23,#ff5721)" : "#b9c4d2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: bankEnabled ? "flex-end" : "flex-start",
                    }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", display: "block" }} />
                  </button>
                </article>
              </div>
              <p className={styles.info}>
                <Info size={17} />
                Bạn có thể bật một hoặc cả hai phương thức thanh toán tùy theo nhu cầu kinh doanh của cửa hàng.
              </p>
            </section>

            <div className={styles.bankColumns}>
              <form onSubmit={save} className={styles.card} noValidate>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                  <h2 style={{ margin: 0 }}>{editing ? "Sửa tài khoản ngân hàng" : "Thông tin chuyển khoản"}</h2>
                  <button
                    type="button"
                    className={styles.outline}
                    style={{ height: 36, padding: "6px 14px", fontSize: 13 }}
                    disabled={busy || loading}
                    onClick={() => { void reload(); }}
                  >
                    Tải lại danh sách
                  </button>
                </div>
                <p className={styles.subtitle}>
                  Thông tin này được lưu vào cơ sở dữ liệu để hiển thị cho sinh viên khi chuyển khoản.
                </p>

                <div style={{ marginBottom: 12 }}>
                  {loading ? (
                    <p style={{ margin: "4px 0" }}>Đang tải ngân hàng…</p>
                  ) : banks === null ? (
                    <p style={{ margin: "4px 0" }}>Chưa tải được danh sách; chưa thể lưu.</p>
                  ) : banks.length === 0 ? (
                    <p style={{ margin: "4px 0", fontSize: 14 }}>Chưa có tài khoản ngân hàng nào được lưu. Hãy chọn ngân hàng và thêm tài khoản bên dưới.</p>
                  ) : (
                    <div style={{ display: "grid", gap: 8, maxHeight: 120, overflowY: "auto" }}>
                      {banks.map((bank) => (
                        <article
                          key={bank.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            padding: "9px 14px",
                            borderRadius: 10,
                            border: editing?.id === bank.id ? "1.5px solid #ff642e" : "1px solid #e2e7ef",
                            background: bank.is_default ? "#f2fcf8" : "#f8f9fb",
                          }}
                        >
                          <div>
                            <h3>{bank.bank_name}{bank.is_default ? " · Mặc định" : ""}</h3>
                            <p style={{ margin: "2px 0 0", fontSize: 13.5 }}>{bank.account_no} · {bank.account_name}</p>
                          </div>
                          <button
                            type="button"
                            className={styles.outline}
                            style={{ height: 36, padding: "6px 14px", fontSize: 13 }}
                            disabled={busy || loading}
                            onClick={() => edit(bank)}
                          >
                            Sửa tài khoản {bank.bank_name}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <fieldset disabled={busy || loading || banks === null} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                  <div className={styles.bankFields}>
                    <label>
                      Ngân hàng <b>*</b>
                      <div className={styles.bankSelect}>
                        <ShieldCheck size={22} aria-hidden="true" />
                        <select
                          name="bank_name"
                          value={values.bank_name}
                          onChange={(event) => setValues((value) => ({ ...value, bank_name: event.target.value }))}
                        >
                          <option value="">Chọn ngân hàng</option>
                          {bankOptions.map((bankOption) => (
                            <option key={bankOption} value={bankOption}>
                              {bankOption}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label>
                      Số tài khoản <b>*</b>
                      <input
                        name="account_no"
                        placeholder="Nhập số tài khoản nhận tiền"
                        value={values.account_no}
                        onChange={(event) => setValues((value) => ({ ...value, account_no: event.target.value }))}
                        autoComplete="off"
                      />
                    </label>

                    <label>
                      Tên chủ tài khoản <b>*</b>
                      <input
                        name="account_name"
                        placeholder="VD: NGUYEN VAN A"
                        value={values.account_name}
                        onChange={(event) => setValues((value) => ({ ...value, account_name: event.target.value }))}
                        autoComplete="off"
                      />
                    </label>

                    <label className={`${styles.defaultOption} ${styles.full}`}>
                      <input
                        type="checkbox"
                        checked={values.is_default}
                        onChange={(event) => setValues((value) => ({ ...value, is_default: event.target.checked }))}
                      />
                      Đặt làm tài khoản nhận tiền mặc định của quán
                    </label>
                  </div>

                  {otherDefault && (
                    <p className={styles.info}>
                      <Info size={16} />
                      Đang có tài khoản mặc định khác. Yêu cầu đặt mặc định mới sẽ bị từ chối an toàn cho đến khi cơ chế chuyển nguyên tử được xác minh; không tự bỏ mặc định cũ.
                    </p>
                  )}

                  <footer className={styles.actions}>
                    <button type="button" className={styles.outline} onClick={() => edit(null)}>
                      {editing ? "Hủy sửa / Thêm mới" : "Xóa nội dung nhập"}
                    </button>
                    <button type="submit" className={styles.primary}>
                      {busy ? "Đang lưu…" : editing ? "Lưu tài khoản" : "Thêm tài khoản"}
                    </button>
                  </footer>
                </fieldset>
              </form>

              <section className={`${styles.card} ${styles.qrCard}`}>
                <h3>Xem trước QR thanh toán</h3>
                <div className={styles.qrPreview}>
                  <strong className={styles.qrBrand}>
                    <span>Viet</span>QR <small>PREVIEW</small>
                  </strong>
                  <div className={styles.qrImage} role="img" aria-label="Hình minh họa QR thanh toán">
                    <PaymentQrIllustration />
                  </div>
                  <strong>{shopName}</strong>
                  <span>{previewBankName || "Chưa chọn ngân hàng"}</span>
                  <span>{previewAccountNo || "Chưa có số tài khoản"}</span>
                  <span>{previewAccountName || "Chưa có tên chủ tài khoản"}</span>
                  <strong className={styles.amount}>45.000đ</strong>
                  <small>Nội dung: {transferContent}</small>
                  <small>(Mã đơn và số tiền mẫu minh họa)</small>
                </div>
                <p className={styles.info}>
                  <Info size={16} />
                  Thông tin ngân hàng đã lưu sẽ hiển thị cho sinh viên khi chọn thanh toán chuyển khoản.
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
                      {entry.done ? <Check size={22} /> : <Info size={22} />}
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
                  <Headphones size={28} />
                </span>
                <div>
                  <h2>Cần hỗ trợ?</h2>
                  <p>Đội ngũ StudentFood luôn sẵn sàng hỗ trợ bạn trong quá trình cài đặt thanh toán.</p>
                </div>
              </div>
              <div className={styles.supportActions}>
                <button type="button" className={styles.outline} onClick={() => setGuide(true)}>
                  <FileText size={17} />
                  Xem hướng dẫn
                </button>
                <button
                  type="button"
                  className={styles.outline}
                  onClick={() => {
                    setError("");
                    setNotice("Hãy chọn ngân hàng, nhập số tài khoản và tên chủ tài khoản trước khi bấm lưu.");
                  }}
                >
                  <MessageCircle size={17} />
                  Liên hệ hỗ trợ
                </button>
              </div>
            </section>
          </aside>
        </div>

        {guide && (
          <section className={styles.guide} aria-label="Hướng dẫn cài đặt thanh toán">
            <button type="button" onClick={() => setGuide(false)} aria-label="Đóng hướng dẫn">
              <X size={18} />
            </button>
            <h3>Hướng dẫn cài đặt</h3>
            <p>
              Chọn ngân hàng từ danh sách cuộn xuống, điền chính xác số tài khoản và tên chủ tài khoản (viết hoa không dấu), sau đó bấm Thêm tài khoản / Lưu tài khoản. Bạn có thể bấm vào nút &ldquo;Sửa tài khoản&rdquo; trên từng dòng để cập nhật lại thông tin bất kỳ lúc nào.
            </p>
          </section>
        )}
      </div>

      {/* Phiên bản Mobile */}
      <div className={styles.mobileView} data-testid="seller-payment-mobile">
        <header className={styles.mobileTopBar}>
          <Link
            href="/seller/shop"
            className={styles.mobileBackBtn}
            aria-label="Quay lại Cửa hàng"
          >
            <ChevronLeft size={25} strokeWidth={2.3} aria-hidden="true" />
          </Link>
          <h1 className={styles.mobileTopTitle}>Thanh toán</h1>
          <span className={styles.mobileTopSpacer} aria-hidden="true" />
        </header>

        <div className={styles.mobileForm} data-testid="seller-payment-mobile-form">
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
                <button
                  type="button"
                  role="switch"
                  aria-checked={cashEnabled}
                  aria-label="Bật Tiền mặt"
                  onClick={() => setCashEnabled((v) => !v)}
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 999,
                    border: 0,
                    padding: 3,
                    background: cashEnabled ? "#149a4f" : "#c5d0de",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: cashEnabled ? "flex-end" : "flex-start",
                  }}
                >
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", display: "block" }} />
                </button>
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
                <button
                  type="button"
                  role="switch"
                  aria-checked={bankEnabled}
                  aria-label="Bật Chuyển khoản"
                  onClick={() => setBankEnabled((v) => !v)}
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 999,
                    border: 0,
                    padding: 3,
                    background: bankEnabled ? "#149a4f" : "#c5d0de",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: bankEnabled ? "flex-end" : "flex-start",
                  }}
                >
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", display: "block" }} />
                </button>
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
              {previewBankName && previewAccountNo
                ? `${previewBankName} · ${previewAccountNo} (${previewAccountName})`
                : "Nhập thông tin ngân hàng ở khung phía trên để lưu."}
            </p>
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
        </div>

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
                  <span>Viet</span>QR <small>PREVIEW</small>
                </strong>
                <div
                  className={styles.qrImage}
                  role="img"
                  aria-label="Hình minh họa QR thanh toán"
                >
                  <PaymentQrIllustration />
                </div>
                <strong>{shopName}</strong>
                <span>{previewBankName || "Chưa chọn ngân hàng"}</span>
                <span>{previewAccountNo || "Chưa có số tài khoản"}</span>
                <span>{previewAccountName || "Chưa có tên chủ tài khoản"}</span>
                <strong className={styles.amount}>45.000đ</strong>
                <small>Nội dung: {transferContent}</small>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
