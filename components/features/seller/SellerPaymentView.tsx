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

export const DEFAULT_SELLER_TRANSFER_CONTENT =
  "Thanh toán đơn hàng StudentFood";

const DEMO_SHOP_NAME = "Cơm Cô Ba";

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

function formatPreviewTransferContent(shopName: string): string {
  const normalized = shopName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  return `#SF0101 ${normalized || "COM CO BA"}`.slice(0, 140);
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

type Bank = SellerBankResult["bank"];
const blank = (): SellerBankCreate => ({
  bank_name: "",
  account_no: "",
  account_name: "",
  is_default: false,
});

export function BankManager({
  actorId,
  restaurantId,
}: {
  actorId: string;
  restaurantId: string;
}) {
  // Không dùng preview/persist store: dữ liệu chỉ thuộc instance user + quán hiện tại.
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [values, setValues] = useState(blank);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const pending = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const current = useCallback(
    () => mounted.current && useAuthStore.getState().user?.id === actorId,
    [actorId],
  );
  const cancel = useCallback(() => {
    generation.current++;
  }, []);

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
        setError(
          err instanceof Error ? err.message : "Không tải được ngân hàng.",
        );
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
    if (!editing || values.is_default !== editing.is_default)
      payload.is_default = values.is_default;
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
      setNotice(
        "API đã xác nhận lưu tài khoản. Thông tin này không tự bật phương thức thanh toán.",
      );
      setEditing(null);
      setValues(blank());
      await reload(); // Đọc lại nguồn DB; không tự mô phỏng bỏ default cũ.
    } catch (err) {
      if (current())
        setError(
          err instanceof Error ? err.message : "Không lưu được ngân hàng.",
        );
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  }

  const otherDefault = banks?.some(
    (bank) => bank.is_default && bank.id !== editing?.id,
  );

  return (
    <main className={styles.main}>
      <header className={styles.heading}>
        <h1>Thanh toán</h1>
        <p>Quản lý tài khoản ngân hàng của cửa hàng.</p>
      </header>
      <section className={styles.card}>
        <h2>Phương thức thanh toán</h2>
        <p>
          Lựa chọn tiền mặt/chuyển khoản chưa được lưu hoặc áp dụng. Thêm ngân
          hàng không tự bật chuyển khoản. Chưa có QR thanh toán ở màn này.
        </p>
      </section>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <div className={styles.content}>
        <div className={styles.left}>
          <section className={styles.card}>
            <h2>Tài khoản ngân hàng</h2>
            <button
              type="button"
              className={styles.outline}
              disabled={busy || loading}
              onClick={() => {
                void reload();
              }}
            >
              Tải lại danh sách
            </button>
            {loading ? (
              <p>Đang tải ngân hàng…</p>
            ) : banks === null ? (
              <p>Chưa tải được danh sách; chưa thể lưu.</p>
            ) : banks.length === 0 ? (
              <p>Chưa có tài khoản ngân hàng.</p>
            ) : (
              banks.map((bank) => (
                <article key={bank.id}>
                  <h3>
                    {bank.bank_name}
                    {bank.is_default ? " · Mặc định" : ""}
                  </h3>
                  <p>
                    {bank.account_no} · {bank.account_name}
                  </p>
                  <button
                    type="button"
                    className={styles.outline}
                    disabled={busy || loading}
                    onClick={() => edit(bank)}
                  >
                    Sửa tài khoản {bank.bank_name}
                  </button>
                </article>
              ))
            )}
          </section>
          <form onSubmit={save} className={styles.card} noValidate>
            <h2>
              {editing ? "Sửa tài khoản ngân hàng" : "Thêm tài khoản ngân hàng"}
            </h2>
            <fieldset
              disabled={busy || loading || banks === null}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <div className={styles.bankFields}>
                <label>
                  Ngân hàng <b>*</b>
                  <input
                    name="bank_name"
                    value={values.bank_name}
                    onChange={(event) =>
                      setValues((value) => ({
                        ...value,
                        bank_name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Số tài khoản <b>*</b>
                  <input
                    name="account_no"
                    value={values.account_no}
                    onChange={(event) =>
                      setValues((value) => ({
                        ...value,
                        account_no: event.target.value,
                      }))
                    }
                    autoComplete="off"
                  />
                </label>
                <label>
                  Tên chủ tài khoản <b>*</b>
                  <input
                    name="account_name"
                    value={values.account_name}
                    onChange={(event) =>
                      setValues((value) => ({
                        ...value,
                        account_name: event.target.value,
                      }))
                    }
                    autoComplete="off"
                  />
                </label>
                <label className={styles.defaultOption}>
                  <input
                    type="checkbox"
                    checked={values.is_default}
                    onChange={(event) =>
                      setValues((value) => ({
                        ...value,
                        is_default: event.target.checked,
                      }))
                    }
                  />
                  Đặt làm mặc định
                </label>
              </div>
              {otherDefault && (
                <p className={styles.info}>
                  Đang có tài khoản mặc định khác. Yêu cầu đặt mặc định mới sẽ
                  bị từ chối an toàn cho đến khi cơ chế chuyển nguyên tử được
                  xác minh; không tự bỏ mặc định cũ.
                </p>
              )}
              <footer className={styles.actions}>
                <button
                  type="button"
                  className={styles.outline}
                  onClick={() => edit(null)}
                >
                  {editing ? "Hủy sửa / Thêm mới" : "Xóa nội dung nhập"}
                </button>
                <button type="submit" className={styles.primary}>
                  {busy
                    ? "Đang lưu…"
                    : editing
                      ? "Lưu tài khoản"
                      : "Thêm tài khoản"}
                </button>
              </footer>
            </fieldset>
          </form>
        </div>
        <aside className={styles.right}>
          <section className={styles.card}>
            <h2>Lưu ý</h2>
            <p>
              Có thể không chọn tài khoản mặc định. Bỏ mặc định không tự chọn tài
              khoản thay thế.
            </p>
            <p>
              Chưa xác minh chủ tài khoản hoặc thực hiện chuyển tiền. Không chia
              sẻ ảnh/log chứa số tài khoản.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default function SellerPaymentView() {
  const { data, error, retry } = useSellerAccess();

  if (error) {
    return (
      <div className={styles.page}>
        <StudentHeader variant="seller" />
        <div className={styles.workspace}>
          <SellerSidebar active="payments" name="" />
          <main className={styles.card}>
            {error}
            <button onClick={retry}>Thử lại</button>
          </main>
        </div>
      </div>
    );
  }

  const name = data?.restaurant?.name || DEMO_SHOP_NAME;
  const effectivePayment = createInitialSellerPaymentPreview(null);
  const formKey = data?.restaurant
    ? `${data.user.id}:${data.restaurant.id}`
    : "preview";

  return (
    <div className={styles.page}>
      <StudentHeader variant="seller" />
      <div className={styles.workspace}>
        <SellerSidebar active="payments" name={name} />
        <PaymentForm
          key={formKey}
          initial={effectivePayment}
          shopName={name}
          actorId={data?.user.id}
          restaurantId={data?.restaurant?.id}
        />
      </div>
    </div>
  );
}

function PaymentForm({
  initial,
  shopName,
  actorId,
  restaurantId,
}: {
  initial: SellerPaymentPreview;
  shopName: string;
  actorId?: string;
  restaurantId?: string;
}) {
  const [values, setValues] = useState(initial);
  const [savedSnapshot, setSavedSnapshot] = useState(initial);
  const [defaultTransferText, setDefaultTransferText] = useState(
    DEFAULT_SELLER_TRANSFER_CONTENT,
  );
  const [savedTransferText, setSavedTransferText] = useState(
    DEFAULT_SELLER_TRANSFER_CONTENT,
  );
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [guide, setGuide] = useState(false);
  const [showMobileQrModal, setShowMobileQrModal] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (actorId && restaurantId) {
      void readSellerBanks(actorId, restaurantId)
        .then((result) => {
          if (!mounted.current || useAuthStore.getState().user?.id !== actorId)
            return;
          const primary =
            result.banks.find((bank) => bank.is_default) ?? result.banks[0];
          if (primary) {
            setEditingBankId(primary.id);
            setValues((current) => {
              const next = {
                ...current,
                bank_name: primary.bank_name,
                account_no: primary.account_no,
                account_name: primary.account_name,
              };
              setSavedSnapshot(next);
              return next;
            });
          }
        })
        .catch(() => {
          // Fallback to initial values if reading banks fails
        });
    }
    return () => {
      mounted.current = false;
    };
  }, [actorId, restaurantId]);

  const cash = values.cashEnabledPreview;
  const transfer = values.bankEnabledPreview;

  // Sample code only; each actual checkout supplies its own server-allocated code.
  const transferContent = formatPreviewTransferContent(shopName);
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
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

    if (actorId && restaurantId && transfer && bankComplete) {
      setBusy(true);
      try {
        const savedBank = await saveSellerBank(
          actorId,
          restaurantId,
          editingBankId,
          {
            bank_name: cleaned.bank_name,
            account_no: cleaned.account_no,
            account_name: cleaned.account_name,
          },
        );
        if (mounted.current) {
          setEditingBankId(savedBank.bank.id);
        }
      } catch (err) {
        if (mounted.current) {
          setBusy(false);
          setError(
            err instanceof Error
              ? err.message
              : "Không thể lưu tài khoản ngân hàng.",
          );
        }
        return;
      }
      if (mounted.current) setBusy(false);
    }

    setSavedSnapshot(cleaned);
    setValues(cleaned);
    setSavedTransferText(
      defaultTransferText.trim() || DEFAULT_SELLER_TRANSFER_CONTENT,
    );
    setDefaultTransferText(
      defaultTransferText.trim() || DEFAULT_SELLER_TRANSFER_CONTENT,
    );
    setError("");
    setNotice(
      actorId && restaurantId
        ? "Đã lưu thông tin ngân hàng và cài đặt thanh toán."
        : "Đã lưu cài đặt trong demo frontend. Chưa ghi DB hoặc xác minh tài khoản ngân hàng.",
    );
  }

  function cancel() {
    setValues(savedSnapshot);
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
                    <label>
                      Nội dung chuyển khoản mặc định
                      <input
                        readOnly
                        value={transferContent}
                        aria-label="Nội dung chuyển khoản mặc định"
                      />
                    </label>
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
              <button type="submit" className={styles.primary} disabled={busy}>
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
              <button
                type="submit"
                className={styles.mobileSaveBtn}
                disabled={busy}
              >
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
