"use client";

import Link from "next/link";
import { Camera, ClipboardList, ScanQrCode, Store } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSellerAccess } from "@/components/features/seller/SellerAccessProvider";
import styles from "@/styles/account.module.css";

export default function AccountStoreJoin() {
  const user = useAuthStore((state) => state.user);
  const { data } = useSellerAccess();
  const isStaff = user?.role === "staff" && Boolean(user.work_for_restaurant_id);
  const shopName = data?.restaurant?.name || "Cửa hàng đang làm việc";

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
          <Link href="/seller/orders" className={styles.scanQrButton}>
            <ClipboardList size={21} aria-hidden="true" />
            <span>Xem & xử lý đơn hàng</span>
          </Link>
          <Link
            href="/seller/shop"
            className={styles.scanQrButton}
            style={{ background: "#fff", color: "#ea580c", border: "1.5px solid #fed7aa" }}
          >
            <Store size={20} aria-hidden="true" />
            <span>Xem thông tin cửa hàng</span>
          </Link>
        </div>
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
