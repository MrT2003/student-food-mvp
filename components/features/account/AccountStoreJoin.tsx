"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, LogOut, ScanQrCode, Store } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSellerAccess } from "@/components/features/seller/SellerAccessProvider";
import styles from "@/styles/account.module.css";

export default function AccountStoreJoin() {
  const user = useAuthStore((state) => state.user);
  const { data } = useSellerAccess();
  const [notice, setNotice] = useState("");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const isStaff = user?.role === "staff" && Boolean(user.work_for_restaurant_id);
  const shopName = data?.restaurant?.name || "Mr.T Restaurant";

  useEffect(() => {
    if (!showLeaveModal) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowLeaveModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLeaveModal]);

  function handleConfirmLeaveStore() {
    setShowLeaveModal(false);
    setNotice(
      `Yêu cầu rời khỏi cửa hàng ${shopName} sẽ được xử lý khi team Backend kết nối API.`,
    );
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
            <p>Bạn là nhân viên chính thức của <strong>{shopName}</strong>.</p>
          </div>
        </div>

        <div className={styles.joinStoreBox} style={{ gap: "0.75rem" }}>
          <button
            type="button"
            className={styles.scanQrButton}
            onClick={() => {
              setNotice("");
              setShowLeaveModal(true);
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

        {notice && (
          <p className={styles.feedback} role="status">
            {notice}
          </p>
        )}

        {showLeaveModal && (
          <div
            className={styles.leaveModalBackdrop}
            role="presentation"
            onClick={() => setShowLeaveModal(false)}
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
                Bạn có chắc chắn muốn rời khỏi cửa hàng {shopName} không? Sau khi
                xác nhận, bạn sẽ không còn là nhân viên của cửa hàng này.
              </p>

              <div className={styles.leaveModalShopCard}>
                <span className={styles.leaveModalShopIcon} aria-hidden="true">
                  <Store size={22} strokeWidth={2.1} />
                </span>
                <div className={styles.leaveModalShopMeta}>
                  <strong>{shopName}</strong>
                  <span>Vai trò hiện tại: Nhân viên chính thức</span>
                </div>
              </div>

              <div className={styles.leaveModalActions}>
                <button
                  type="button"
                  className={styles.leaveModalStayBtn}
                  onClick={() => setShowLeaveModal(false)}
                >
                  Ở lại
                </button>

                <button
                  type="button"
                  className={styles.leaveModalConfirmBtn}
                  onClick={handleConfirmLeaveStore}
                >
                  Xác nhận rời khỏi
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
