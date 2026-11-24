"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, LogOut, ScanQrCode, Store } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSellerAccess } from "@/components/features/seller/SellerAccessProvider";
import { leaveStaffRestaurant } from "@/lib/seller/staff-client";
import styles from "@/styles/account.module.css";

export default function AccountStoreJoin() {
  const user = useAuthStore((state) => state.user);
  const { data } = useSellerAccess();
  const [feedback, setFeedback] = useState<{ actorId: string; text: string; error: boolean } | null>(null);
  const [confirmation, setConfirmation] = useState<{ actorId: string; restaurantId: string; name: string } | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const restaurantId = user?.work_for_restaurant_id;
  const isStaff = user?.role === "staff" && Boolean(restaurantId);
  const shopName = data?.user.id === user?.id && data?.restaurant?.id === restaurantId
    ? data?.restaurant?.name : undefined;
  const modal = isStaff && confirmation?.actorId === user?.id &&
    confirmation?.restaurantId === restaurantId ? confirmation : null;
  const notice = feedback?.actorId === user?.id ? feedback : null;

  useEffect(() => {
    if (!modal) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting.current) setConfirmation(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal]);

  async function handleConfirmLeaveStore() {
    if (!modal || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await leaveStaffRestaurant(modal.actorId, modal.restaurantId);
      setConfirmation(null);
      setFeedback({ actorId: modal.actorId, text: "Bạn đã rời cửa hàng.", error: false });
    } catch (error) {
      setFeedback({
        actorId: modal.actorId, error: true,
        text: error instanceof Error ? error.message : "Chưa xác nhận được kết quả rời cửa hàng.",
      });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  if (isStaff) {
    return (
      <section className={styles.card} aria-labelledby="join-store-title">
        <div className={styles.sectionHeading}>
          <span className={styles.sectionIcon}>
            <Store size={26} aria-hidden="true" />
          </span>
          <div>
            <h2 id="join-store-title">Cửa hàng đang làm việc</h2>
            <p>{shopName ? <>Bạn là nhân viên chính thức của <strong>{shopName}</strong>.</> : "Chưa tải được tên cửa hàng hiện tại."}</p>
          </div>
        </div>

        <div className={styles.joinStoreBox} style={{ gap: "0.75rem" }}>
          <button
            type="button"
            className={styles.scanQrButton}
            disabled={pending || !shopName || !restaurantId}
            onClick={() => {
              if (!user || !shopName || !restaurantId) return;
              setFeedback(null);
              setConfirmation({ actorId: user.id, restaurantId, name: shopName });
            }}
          >
            <LogOut size={20} aria-hidden="true" />
            <span>Rời khỏi cửa hàng</span>
          </button>
          <Link
            href="/seller/shop"
            className={styles.scanQrButton}
            style={{ background: "#fff", color: "#ea580c", border: "1.5px solid #fed7aa" }}
          >
            <Store size={20} aria-hidden="true" />
            <span>Xem thông tin cửa hàng</span>
          </Link>
        </div>

        {notice && !modal && (
          <p className={styles.feedback} role={notice.error ? "alert" : "status"}>
            {notice.text}
          </p>
        )}

        {modal && (
          <div
            className={styles.leaveModalBackdrop}
            role="presentation"
            onClick={() => { if (!submitting.current) setConfirmation(null); }}
          >
            <div
              className={styles.leaveModalDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="leave-store-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.leaveModalTopIcon} aria-hidden="true">
                <LogOut size={28} strokeWidth={2.2} />
              </div>

              <h3 id="leave-store-modal-title" className={styles.leaveModalTitle}>
                Xác nhận rời khỏi cửa hàng
              </h3>

              <p className={styles.leaveModalDescription}>
                Bạn có chắc chắn muốn rời khỏi cửa hàng {modal.name} không? Sau khi
                xác nhận, bạn sẽ không còn là nhân viên của cửa hàng này.
              </p>

              <div className={styles.leaveModalShopCard}>
                <span className={styles.leaveModalShopIcon} aria-hidden="true">
                  <Store size={22} strokeWidth={2.1} />
                </span>
                <div className={styles.leaveModalShopMeta}>
                  <strong>{modal.name}</strong>
                  <span>Vai trò hiện tại: Nhân viên chính thức</span>
                </div>
              </div>

              {notice?.error && <p className={styles.feedback} role="alert">{notice.text}</p>}
              <div className={styles.leaveModalActions}>
                <button
                  type="button"
                  className={styles.leaveModalStayBtn}
                  disabled={pending}
                  onClick={() => { if (!submitting.current) setConfirmation(null); }}
                >
                  Ở lại
                </button>

                <button
                  type="button"
                  className={styles.leaveModalConfirmBtn}
                  disabled={pending}
                  onClick={handleConfirmLeaveStore}
                >
                  {pending ? "Đang rời…" : "Rời cửa hàng"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="join-store-title">
      {notice && <p className={styles.feedback} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
      <div className={styles.sectionHeading}>
        <span className={styles.sectionIcon}>
          <Store size={26} aria-hidden="true" />
        </span>
        <div>
          <h2 id="join-store-title">Gia nhập cửa hàng</h2>
          <p>Quét mã QR từ chủ quán để gửi yêu cầu xin làm nhân viên.</p>
        </div>
      </div>

      <div className={styles.joinStoreBox}>
        <span className={styles.qrBadgeIcon} aria-hidden="true">
          <ScanQrCode size={32} strokeWidth={2} />
        </span>

        <Link href="/account/join-store" className={styles.scanQrButton}>
          <Camera size={21} aria-hidden="true" />
          <span>Quét QR xin việc</span>
        </Link>
      </div>
    </section>
  );
}
