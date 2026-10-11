"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, FileText, Headphones, Info, MessageCircle, ShieldCheck, Wallet, X } from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import { useSellerPreviewStore } from "@/store/useSellerPreviewStore";
import { useSellerShopStore } from "@/store/useSellerShopStore";
import { useSellerPaymentStore, type SellerPaymentPreview } from "@/store/useSellerPaymentStore";
import { demoSellerRestaurant } from "@/lib/mocks/seller-orders.mock";
import { mockRestaurantNumbers } from "@/lib/mocks/catalog.mock";
import { formatOrderCode, formatTransferContent } from "@/lib/orders/order-code";
import TransferContent from "@/components/ui/TransferContent";
import styles from "@/styles/seller-payments.module.css";

const banks = ["Vietcombank", "BIDV", "VietinBank", "Agribank", "Techcombank", "MB Bank", "ACB", "TPBank", "VPBank", "Sacombank"];

function CashIcon({ size = 40 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect x="2" y="7" width="36" height="26" rx="3" fill="currentColor" /><path d="M10 11h20a4 4 0 0 0 4 4v10a4 4 0 0 0-4 4H10a4 4 0 0 0-4-4V15a4 4 0 0 0 4-4Z" fill="#e5faee" /><ellipse cx="20" cy="20" rx="6" ry="8" fill="currentColor" /><circle cx="10" cy="20" r="1.5" fill="currentColor" /><circle cx="30" cy="20" r="1.5" fill="currentColor" /></svg>;
}

function BankIcon({ size = 40 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="currentColor" aria-hidden="true"><path d="m20 2 18 10v4H2v-4L20 2ZM5 34h30v4H5zM8 18h6v14H8zm9 0h6v14h-6zm9 0h6v14h-6z" /><circle cx="20" cy="11" r="2" fill="#e9f2ff" /></svg>;
}

// Decorative pattern only, deliberately not a payment QR payload.
function PaymentQrIllustration() {
  const finders = [[0, 0], [22, 0], [0, 22]];
  const dots = Array.from({ length: 29 * 29 }, (_, index) => ({ x: index % 29, y: Math.floor(index / 29) }))
    .filter(({ x, y }) => !finders.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7) &&
      !(x >= 11 && x <= 17 && y >= 11 && y <= 17) && ((x * 19 + y * 13 + x * y * 7) % 11 < 6));
  return <svg viewBox="-1 -1 31 31" aria-hidden="true" focusable="false">
    <rect x={-1} y={-1} width={31} height={31} fill="white" />
    {dots.map(({ x, y }) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#102119" />)}
    {finders.map(([x, y]) => <g key={`${x}-${y}`}><rect x={x} y={y} width={7} height={7} fill="#102119" /><rect x={x + 1} y={y + 1} width={5} height={5} fill="white" /><rect x={x + 2} y={y + 2} width={3} height={3} fill="#102119" /></g>)}
    <rect x={11} y={11} width={7} height={7} rx={1} fill="#e2f4e9" />
    <path d="M12.5 12.5 14.5 12 16.5 12.5v2c0 1.3-1 2.2-2 3-1-.8-2-1.7-2-3Z" fill="#048552" />
  </svg>;
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
      useSellerPaymentStore.getState().initialize(useSellerPreviewStore.getState().draft);
      setReady(true);
    });
    return () => { mounted = false; };
  }, []);
  const name = shopName || draft?.name || demoSellerRestaurant.name;
  return <div className={styles.page}><StudentHeader variant="seller" /><div className={styles.workspace}>
    <SellerSidebar active="payments" name={name} />
    {ready && saved ? <PaymentForm initial={saved} shopName={name} /> : <main className={styles.card}>Đang tải cài đặt thanh toán…</main>}
  </div></div>;
}

function PaymentForm({ initial, shopName }: { initial: SellerPaymentPreview; shopName: string }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [guide, setGuide] = useState(false);
  const savePreview = useSellerPaymentStore((state) => state.save);
  const cash = values.cashEnabledPreview, transfer = values.bankEnabledPreview;
  // Sample code only; each actual checkout supplies its own server-allocated code.
  const transferContent = formatTransferContent(formatOrderCode(mockRestaurantNumbers[demoSellerRestaurant.id], 1), shopName);
  const bankComplete = Boolean(values.bank_name && /^\d{6,19}$/.test(values.account_no.trim()) && values.account_name.trim());
  const enabledCount = Number(cash) + Number(transfer);
  const configured = !transfer || bankComplete;
  function field<K extends keyof SellerPaymentPreview>(key: K, value: SellerPaymentPreview[K]) {
    setValues((current) => ({ ...current, [key]: value })); setError(""); setNotice("");
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabledCount) { setError("Cần bật ít nhất một phương thức thanh toán."); return; }
    if (transfer && !bankComplete) { setError("Nhập ngân hàng, số tài khoản 6–19 chữ số và tên chủ tài khoản."); return; }
    const cleaned = { ...values, account_no: values.account_no.trim(), account_name: values.account_name.trim().toUpperCase(),
      branchPreview: values.branchPreview.trim() };
    savePreview(cleaned); setValues(cleaned);
    const draft = useSellerPreviewStore.getState().draft;
    if (draft) useSellerPreviewStore.getState().registerPreview({ ...draft, cash, bank: transfer });
    setError(""); setNotice("Đã lưu cài đặt trong demo frontend. Chưa ghi DB hoặc xác minh tài khoản ngân hàng.");
  }
  function cancel() {
    const saved = useSellerPaymentStore.getState().saved;
    if (saved) setValues(saved);
    setError(""); setNotice("Đã khôi phục cài đặt được lưu gần nhất trong bản demo.");
  }
  const checks = [
    { title: cash ? "Tiền mặt đã được bật" : "Tiền mặt đang tắt", text: cash ? "Phương thức thanh toán tiền mặt đang hoạt động." : "Khách không thể chọn tiền mặt trong cấu hình này.", done: cash },
    { title: transfer ? "Chuyển khoản đã được bật" : "Chuyển khoản đang tắt", text: transfer ? "Phương thức chuyển khoản đang hoạt động." : "Khách không thể chọn chuyển khoản trong cấu hình này.", done: transfer },
    { title: bankComplete ? "Thông tin ngân hàng đã đầy đủ" : "Thông tin ngân hàng chưa đầy đủ", text: bankComplete ? "Đã cung cấp đầy đủ thông tin tài khoản." : "Bổ sung các trường bắt buộc nếu dùng chuyển khoản.", done: bankComplete },
    { title: enabledCount && configured ? "Sẵn sàng nhận thanh toán" : "Chưa sẵn sàng nhận thanh toán", text: "Trạng thái xem trước, chưa áp dụng trên hệ thống.", done: Boolean(enabledCount && configured) },
  ];
  return <main className={styles.main}>
    <header className={styles.heading}><h1>Thanh toán</h1><p>Cài đặt phương thức thanh toán và thông tin tài khoản ngân hàng để nhận tiền từ sinh viên.</p></header>
    <div className={styles.stats}>
      <article className={styles.card}><span className={styles.statIcon} data-tone="blue"><Wallet size={29} /></span><div><h3>Phương thức đang bật</h3><strong className={styles.count}>{enabledCount}</strong><p>Tổng số phương thức thanh toán hiện đang hoạt động</p></div></article>
      <article className={styles.card}><span className={styles.statIcon} data-tone="green"><CashIcon size={40} /></span><div><h3>Tiền mặt</h3><span className={styles.badge} data-on={cash}>● {cash ? "Đã bật" : "Đang tắt"}</span><p>Khách hàng thanh toán khi nhận món.</p></div></article>
      <article className={styles.card}><span className={styles.statIcon} data-tone="blue"><BankIcon size={40} /></span><div><div className={styles.statTitle}><h3>Chuyển khoản</h3><span className={styles.badge} data-on={bankComplete}>● {bankComplete ? "Đã cấu hình" : "Chưa cấu hình"}</span></div><p>{bankComplete ? "Đã thiết lập thông tin ngân hàng nhận thanh toán." : "Bổ sung thông tin ngân hàng nhận thanh toán."}</p></div></article>
    </div>
    {(error || notice) && <p className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || notice}</p>}
    <form onSubmit={save} className={styles.content} noValidate>
      <div className={styles.left}>
        <section className={styles.card}><h2>Phương thức thanh toán</h2><div className={styles.methods}>
          {[{ key: "cashEnabledPreview" as const, title: "Tiền mặt", text: "Khách hàng thanh toán khi nhận món.", enabled: cash, icon: CashIcon, tone: "green" },
            { key: "bankEnabledPreview" as const, title: "Chuyển khoản", text: "Khách hàng chuyển khoản trước hoặc theo hướng dẫn của cửa hàng.", enabled: transfer, icon: BankIcon, tone: "blue" }].map(({ key, title, text, enabled, icon: Icon, tone }) => <article key={key} className={styles.method} data-enabled={enabled}>
              <span className={styles.methodIcon} data-tone={tone}><Icon size={43} /></span><div><h3>{title}</h3><p>{text}</p><span className={styles.badge} data-on={enabled}>● {enabled ? "Đang bật" : "Đang tắt"}</span></div>
              <label className={styles.switch}><input type="checkbox" role="switch" aria-label={`Bật ${title}`} checked={enabled} onChange={(event) => field(key, event.target.checked)} /></label>
            </article>)}
        </div><p className={styles.info}><Info size={17} />Bạn có thể bật một hoặc cả hai phương thức thanh toán tùy theo nhu cầu kinh doanh của cửa hàng.</p></section>
        <div className={styles.bankColumns}>
          <section className={styles.card}><h2>Thông tin chuyển khoản</h2><p className={styles.subtitle}>Thông tin này sẽ được sử dụng để tạo mã QR chuyển khoản cho sinh viên.</p><div className={styles.bankFields}>
            <label>Ngân hàng <b>*</b><div className={styles.bankSelect}><ShieldCheck size={23} aria-hidden="true" /><select value={values.bank_name} onChange={(event) => field("bank_name", event.target.value)}><option value="">Chọn ngân hàng</option>{[...new Set([...banks, values.bank_name].filter(Boolean))].map((name) => <option key={name}>{name}</option>)}</select></div></label>
            <label>Số tài khoản <b>*</b><input inputMode="numeric" maxLength={19} value={values.account_no} onChange={(event) => field("account_no", event.target.value)} autoComplete="off" /></label>
            <label>Tên chủ tài khoản <b>*</b><input maxLength={100} value={values.account_name} onChange={(event) => field("account_name", event.target.value)} autoComplete="off" /></label>
            <label>Chi nhánh <span>(tùy chọn)</span><input maxLength={120} value={values.branchPreview} onChange={(event) => field("branchPreview", event.target.value)} /></label>
            <div className={styles.full}><TransferContent value={transferContent} variant="field" /><small>Nội dung được tạo tự động từ mã đơn và tên quán, thay đổi theo từng đơn hàng.</small></div>
          </div></section>
          <section className={`${styles.card} ${styles.qrCard}`}><h3>Xem trước QR thanh toán</h3><div className={styles.qrPreview}>
            <strong className={styles.qrBrand}><span>Viet</span>QR <small>DEMO</small></strong><div className={styles.qrImage} role="img" aria-label="Hình minh họa QR, không dùng để thanh toán"><PaymentQrIllustration /></div>
            <strong>{shopName}</strong><span>{values.bank_name || "Chưa chọn ngân hàng"}</span><span>{values.account_no || "Chưa có số tài khoản"}</span><span>{values.account_name || "Chưa có tên chủ tài khoản"}</span>
            <strong className={styles.amount}>45.000đ</strong><small>Nội dung: {transferContent}</small><small>(Mã đơn và số tiền mẫu, không phải đơn hàng thật)</small>
          </div><p className={styles.info}><Info size={16} />QR thật sẽ được tạo theo từng đơn khi nối API.</p></section>
        </div>
      </div>
      <aside className={styles.right}>
        <section className={styles.card}><h2>Trạng thái cấu hình</h2><div className={styles.checks}>{checks.map((entry) => <article key={entry.title}><span data-done={entry.done}>{entry.done ? <Check size={23} /> : <Info size={23} />}</span><div><h3>{entry.title}</h3><p>{entry.text}</p></div></article>)}</div></section>
        <section className={styles.card}><div className={styles.supportHeading}><span><Headphones size={31} /></span><div><h2>Cần hỗ trợ?</h2><p>Đội ngũ StudentFood luôn sẵn sàng hỗ trợ bạn trong quá trình cài đặt thanh toán.</p></div></div><div className={styles.supportActions}>
          <button type="button" className={styles.outline} onClick={() => setGuide(true)}><FileText size={18} />Xem hướng dẫn</button><button type="button" className={styles.outline} onClick={() => { setError(""); setNotice("Kênh liên hệ hỗ trợ chưa được cấu hình trong bản demo."); }}><MessageCircle size={18} />Liên hệ hỗ trợ</button>
        </div></section>
        <footer className={styles.actions}><button type="button" className={styles.outline} onClick={cancel}>Hủy thay đổi</button><button type="submit" className={styles.primary}>Lưu thay đổi</button></footer>
      </aside>
    </form>
    {guide && <section className={styles.guide} aria-label="Hướng dẫn cài đặt thanh toán"><button type="button" onClick={() => setGuide(false)} aria-label="Đóng hướng dẫn"><X size={18} /></button><h3>Hướng dẫn cài đặt</h3><p>Bật ít nhất một phương thức. Nếu bật chuyển khoản, nhập ngân hàng, số tài khoản và tên chủ tài khoản, rồi bấm Lưu thay đổi. Nội dung chuyển khoản tự tạo theo từng đơn. Hủy thay đổi khôi phục lần lưu gần nhất.</p></section>}
  </main>;
}
