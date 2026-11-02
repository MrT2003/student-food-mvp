"use client";

import Link from "next/link";
import { Camera, ScanQrCode, Store } from "lucide-react";
import styles from "@/styles/account.module.css";

export default function AccountStoreJoin() {
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
