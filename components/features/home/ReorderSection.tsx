"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Clock3, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { OrderServices } from "@/services/order.service";
import { useAuthStore } from "@/store/useAuthStore";
import { createClient } from "@/lib/supabase/client";
import type { OrderedSummary } from "@/types/order.types";
import type { PreviewRestaurant } from "@/lib/home/mock-data";
import { formatMoney } from "@/lib/format";
import FoodPlaceholder from "./FoodPlaceholder";
import styles from "@/styles/home.module.css";
import Link from "next/link";

// Giữ tương thích props của HomeView; danh sách này chỉ lấy dữ liệu thật.
type Props = { restaurants?: PreviewRestaurant[]; onSelect?: (restaurant: PreviewRestaurant) => void };

export default function ReorderSection(_props: Props) {
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);
  const authStatus = useAuthStore((state) => state.status);
  const [result, setResult] = useState<{ userId: string; items: OrderedSummary[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<OrderedSummary | null>(null);
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSelected(null);
    setNotice("");
    setError("");
    if (!userId || authStatus !== "ready") { setResult(null); setLoading(false); return; }
    setLoading(true);
    // Mỗi phần tử là order_items.id; không group theo quán hoặc món.
    OrderServices.fetchOrdered(10)
      .then((items) => { if (!cancelled) setResult({ userId, items }); })
      .catch((reason: unknown) => {
        if (!cancelled) { setResult(null); setError(reason instanceof Error ? reason.message : "Không thể tải món đã đặt."); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    // Bỏ kết quả request cũ khi đổi tài khoản hoặc rời trang.
    return () => { cancelled = true; };
  }, [userId, authStatus, retry]);

  // Khi chưa đăng nhập, hai vế optional có thể cùng undefined; phải kiểm tra result trước.
  const items = result && result.userId === userId ? result.items : [];
  const price = (item: OrderedSummary) => item.lineTotalSnapshot == null ? "Chưa có dữ liệu giá" : formatMoney(item.lineTotalSnapshot);

  async function openMenu(item: OrderedSummary) {
    if (!item.menuItemId) { setNotice("Món không còn trong thực đơn. Bạn vẫn có thể xem thông tin lần đặt trước."); return; }
    setOpening(true);
    setNotice("");
    try {
      // Chỉ tra đường dẫn catalog khi bấm Đặt lại; không thêm giỏ bằng giá/options cũ.
      const { data, error: queryError } = await createClient().from("restaurants")
        .select("slug").eq("id", item.restaurantId).maybeSingle();
      if (queryError) throw new Error(queryError.message);
      if (!data?.slug) throw new Error("Không thể mở thực đơn của quán lúc này.");
      router.push(`/restaurants/${encodeURIComponent(data.slug)}/menu/${encodeURIComponent(item.menuItemId)}?orderItemId=${encodeURIComponent(item.orderItemId)}`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Không thể mở món ăn.");
    } finally { setOpening(false); }
  }

  return (
    <section id="reorder" className={styles.reorderSection} aria-labelledby="reorder-title">
      <div className={styles.sectionHeading}>
        <h2 id="reorder-title"><span className={styles.sectionIcon}><Clock3 size={25} aria-hidden="true" /></span>Đặt lại nhanh</h2>
        <Link className={styles.seeAll} href="/orders/history">Xem tất cả<ArrowRight size={21} aria-hidden="true" /></Link>
      </div>
      {authStatus === "loading" || loading ? <p role="status">Đang tải món đã đặt…</p>
        : authStatus === "error" ? <p role="alert">Không thể xác định phiên đăng nhập. Vui lòng tải lại trang.</p>
        : !userId ? <p>Đăng nhập để xem các món bạn đã đặt.</p>
        : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></div>
        : items.length === 0 ? <p>Bạn chưa có món đã đặt.</p> : null}
      {notice && <p role="status">{notice}</p>}
      <div className={styles.restaurantGrid} data-compact="true" aria-busy={loading}>
        {items.map((item) => (
          <article key={item.orderItemId} className={`${styles.reorderCard} ${styles.snapshotCard}`} data-dimmed={item.isDimmed}>
            {/* Dùng button thay div onclick để bàn phím cũng mở được thẻ bị làm mờ. */}
            <button type="button" className={styles.snapshotDetails} onClick={() => setSelected(item)} aria-label={`Xem lần đặt ${item.name}`}>
              <FoodPlaceholder restaurant={{ illustration: "rice", avatar_url: item.imageUrl }} small />
              <span className={styles.snapshotInfo}>
                <strong>{item.name}</strong>
                <span>{item.restaurantName ?? "Quán không còn khả dụng"}</span>
                {/* Phân loại cũ đã bỏ: <p>{restaurant.categories.join(", ")}</p> */}
                <span>Số lượng: {item.quantity}</span>
                <span className={styles.snapshotPrice}>Tổng lần đặt: {price(item)}</span>
                {item.notices.map((message) => <span key={message} className={styles.snapshotNotice}>{message}</span>)}
              </span>
            </button>
            <button type="button" className={styles.outlineButton} disabled={opening} onClick={() => void openMenu(item)}>
              <RotateCcw size={17} aria-hidden="true" />Đặt lại
            </button>
          </article>
        ))}
      </div>
      {/* Chi tiết snapshot vẫn xem được ngay cả khi catalog đã ngừng phục vụ/xóa món. */}
      {selected && result?.userId === userId && (
        <section className={styles.reorderNotice} aria-label="Thông tin lần đặt trước">
          <h3>{selected.name}</h3>
          <p>Mã đơn: {selected.orderCode}</p>
          <p>Số lượng: {selected.quantity} · Tổng lần đặt: {price(selected)}</p>
          <p>Giá này được lưu tại lần đặt trước. Giá đặt lại được hiển thị trên thực đơn hiện tại.</p>
          {selected.notices.map((message) => <p key={message}>{message}</p>)}
          <button type="button" onClick={() => setSelected(null)}>Đóng thông tin</button>
        </section>
      )}
    </section>
  );
}
