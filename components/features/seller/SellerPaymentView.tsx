"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import { useSellerAccess } from "./SellerAccessProvider";
import { useAuthStore } from "@/store/useAuthStore";
import { readSellerBanks, saveSellerBank } from "@/lib/seller/management-client";
import type { SellerBankResult, SellerBankCreate, SellerBankPatch } from "@/types/seller.types";
import styles from "@/styles/seller-payments.module.css";

type Bank = SellerBankResult["bank"];
const blank = (): SellerBankCreate => ({ bank_name: "", account_no: "", account_name: "", is_default: false });

export default function SellerPaymentView() {
  const { data, error, retry } = useSellerAccess();
  return <div className={styles.page}><StudentHeader variant="seller" /><div className={styles.workspace}>
    <SellerSidebar active="payments" name={data?.restaurant?.name ?? ""} />
    {data?.restaurant ? <BankManager key={`${data.user.id}:${data.restaurant.id}`} actorId={data.user.id} restaurantId={data.restaurant.id} />
      : <main className={styles.card}>{error || "Đang tải cửa hàng…"}{error && <button onClick={retry}>Thử lại</button>}</main>}
  </div></div>;
}

export function BankManager({ actorId, restaurantId }: { actorId: string; restaurantId: string }) {
  // Không dùng preview/persist store: dữ liệu chỉ thuộc instance user + quán hiện tại.
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [values, setValues] = useState(blank);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const pending = useRef(false), mounted = useRef(true), generation = useRef(0);
  const current = useCallback(() => mounted.current && useAuthStore.getState().user?.id === actorId, [actorId]);
  const cancel = useCallback(() => { generation.current++; }, []);

  const reload = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true);
    try {
      const result = await readSellerBanks(actorId, restaurantId);
      if (current() && run === generation.current) { setBanks(result.banks); setError(""); }
    } catch (err) {
      if (current() && run === generation.current) { setBanks(null); setError(err instanceof Error ? err.message : "Không tải được ngân hàng."); }
    } finally { if (current() && run === generation.current) setLoading(false); }
  }, [actorId, restaurantId, current]);
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => { if (mounted.current) void reload(); });
    return () => { mounted.current = false; cancel(); };
    // Component được key theo actorId/restaurantId; không tái dùng cache giữa user.
  }, [reload, cancel]);

  function edit(bank: Bank | null) {
    if (pending.current) return;
    setEditing(bank); setValues(bank ? { bank_name: bank.bank_name, account_no: bank.account_no, account_name: bank.account_name, is_default: bank.is_default } : blank());
    setError(""); setNotice("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || banks === null) return;
    const payload: SellerBankPatch = {};
    for (const field of ["bank_name", "account_no", "account_name"] as const) {
      if (!editing || values[field] !== editing[field]) {
        if (!values[field].trim()) { setError("Nhập ngân hàng, số tài khoản và tên chủ tài khoản."); return; }
        payload[field] = values[field];
      }
    }
    if (!editing || values.is_default !== editing.is_default) payload.is_default = values.is_default;
    if (!Object.keys(payload).length) { setNotice("Không có thay đổi để lưu."); return; }
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await saveSellerBank(actorId, restaurantId, editing?.id ?? null, payload);
      if (!current()) return;
      setNotice("API đã xác nhận lưu tài khoản. Thông tin này không tự bật phương thức thanh toán.");
      setEditing(null); setValues(blank());
      await reload(); // Đọc lại nguồn DB; không tự mô phỏng bỏ default cũ.
    } catch (err) {
      if (current()) setError(err instanceof Error ? err.message : "Không lưu được ngân hàng.");
    } finally { pending.current = false; if (current()) setBusy(false); }
  }
  const otherDefault = banks?.some(bank => bank.is_default && bank.id !== editing?.id);
  return <main className={styles.main}>
    <header className={styles.heading}><h1>Thanh toán</h1><p>Quản lý tài khoản ngân hàng của cửa hàng.</p></header>
    <section className={styles.card}><h2>Phương thức thanh toán</h2><p>Lựa chọn tiền mặt/chuyển khoản chưa được lưu hoặc áp dụng. Thêm ngân hàng không tự bật chuyển khoản. Chưa có QR thanh toán ở màn này.</p></section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <div className={styles.content}><div className={styles.left}>
      <section className={styles.card}><h2>Tài khoản ngân hàng</h2>
        <button type="button" className={styles.outline} disabled={busy || loading} onClick={() => { void reload(); }}>Tải lại danh sách</button>
        {loading ? <p>Đang tải ngân hàng…</p> : banks === null ? <p>Chưa tải được danh sách; chưa thể lưu.</p> : banks.length === 0 ? <p>Chưa có tài khoản ngân hàng.</p> :
          banks.map(bank => <article key={bank.id}><h3>{bank.bank_name}{bank.is_default ? " · Mặc định" : ""}</h3><p>{bank.account_no} · {bank.account_name}</p>
            <button type="button" className={styles.outline} disabled={busy || loading} onClick={() => edit(bank)}>Sửa tài khoản {bank.bank_name}</button></article>)}
      </section>
      <form onSubmit={save} className={styles.card} noValidate>
        <h2>{editing ? "Sửa tài khoản ngân hàng" : "Thêm tài khoản ngân hàng"}</h2>
        <fieldset disabled={busy || loading || banks === null} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className={styles.bankFields}>
            <label>Ngân hàng <b>*</b><input name="bank_name" value={values.bank_name} onChange={event => setValues(value => ({ ...value, bank_name: event.target.value }))} /></label>
            <label>Số tài khoản <b>*</b><input name="account_no" value={values.account_no} onChange={event => setValues(value => ({ ...value, account_no: event.target.value }))} autoComplete="off" /></label>
            <label>Tên chủ tài khoản <b>*</b><input name="account_name" value={values.account_name} onChange={event => setValues(value => ({ ...value, account_name: event.target.value }))} autoComplete="off" /></label>
            <label className={styles.defaultOption}><input type="checkbox" checked={values.is_default} onChange={event => setValues(value => ({ ...value, is_default: event.target.checked }))} />Đặt làm mặc định</label>
          </div>
          {otherDefault && <p className={styles.info}>Đang có tài khoản mặc định khác. Yêu cầu đặt mặc định mới sẽ bị từ chối an toàn cho đến khi cơ chế chuyển nguyên tử được xác minh; không tự bỏ mặc định cũ.</p>}
          <footer className={styles.actions}><button type="button" className={styles.outline} onClick={() => edit(null)}>{editing ? "Hủy sửa / Thêm mới" : "Xóa nội dung nhập"}</button>
            <button type="submit" className={styles.primary}>{busy ? "Đang lưu…" : editing ? "Lưu tài khoản" : "Thêm tài khoản"}</button></footer>
        </fieldset>
      </form>
    </div><aside className={styles.right}><section className={styles.card}><h2>Lưu ý</h2><p>Có thể không chọn tài khoản mặc định. Bỏ mặc định không tự chọn tài khoản thay thế.</p><p>Chưa xác minh chủ tài khoản hoặc thực hiện chuyển tiền. Không chia sẻ ảnh/log chứa số tài khoản.</p></section></aside></div>
  </main>;
}
