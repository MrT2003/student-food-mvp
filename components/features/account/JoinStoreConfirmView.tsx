"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  MapPin,
  Send,
} from "lucide-react";
import styles from "@/styles/account-join-store-qr.module.css";

function StoreRiceBowlArtwork() {
  return (
    <svg
      viewBox="0 0 120 120"
      className={styles.storeThumbSvg}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="woodBg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#6b442a" />
          <stop offset="100%" stopColor="#3c2414" />
        </radialGradient>
        <linearGradient id="porkGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e29443" />
          <stop offset="50%" stopColor="#bd641e" />
          <stop offset="100%" stopColor="#853a0b" />
        </linearGradient>
      </defs>
      {/* Wood table background */}
      <rect width="120" height="120" rx="16" fill="url(#woodBg)" />
      {/* Dark ceramic plate */}
      <circle cx="58" cy="64" r="46" fill="#1f1b18" />
      <circle
        cx="58"
        cy="64"
        r="42"
        fill="#2a2420"
        stroke="#3c342e"
        strokeWidth="1.5"
      />
      {/* White rice bed */}
      <ellipse cx="55" cy="72" rx="31" ry="22" fill="#f9f6f0" />
      <ellipse cx="48" cy="68" rx="22" ry="16" fill="#ffffff" />
      {/* Salad & cucumber slices (top-left) */}
      <circle cx="34" cy="48" r="10" fill="#4f9e3a" />
      <circle cx="44" cy="42" r="9" fill="#63b548" />
      <circle
        cx="32"
        cy="54"
        r="7.5"
        fill="#c8eab5"
        stroke="#3f872c"
        strokeWidth="2"
      />
      <circle
        cx="41"
        cy="49"
        r="7.5"
        fill="#d5f2c4"
        stroke="#3f872c"
        strokeWidth="2"
      />
      <circle
        cx="49"
        cy="45"
        r="7"
        fill="#c8eab5"
        stroke="#3f872c"
        strokeWidth="2"
      />
      {/* Tomato slice */}
      <circle cx="28" cy="65" r="6.5" fill="#e03c26" />
      <circle cx="28" cy="65" r="4" fill="#ff7359" />
      {/* Fish sauce dipping bowl (top-right) */}
      <circle cx="77" cy="42" r="13" fill="#f5f1eb" />
      <circle cx="77" cy="42" r="10" fill="#d9481e" />
      <circle cx="75" cy="40" r="1.5" fill="#ffcf96" />
      <circle cx="80" cy="43" r="1.3" fill="#ffcf96" />
      {/* Grilled pork ribs slices */}
      <g transform="rotate(-18 62 72)">
        <rect
          x="40"
          y="58"
          width="11"
          height="28"
          rx="5"
          fill="url(#porkGrad)"
          stroke="#6b2c06"
          strokeWidth="1"
        />
        <rect
          x="50"
          y="56"
          width="11"
          height="30"
          rx="5"
          fill="url(#porkGrad)"
          stroke="#6b2c06"
          strokeWidth="1"
        />
        <rect
          x="60"
          y="56"
          width="11"
          height="30"
          rx="5"
          fill="url(#porkGrad)"
          stroke="#6b2c06"
          strokeWidth="1"
        />
        <rect
          x="70"
          y="58"
          width="11"
          height="27"
          rx="5"
          fill="url(#porkGrad)"
          stroke="#6b2c06"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

export default function JoinStoreConfirmView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const storeName = searchParams.get("store")?.trim() || "Cơm Cô Ba";
  const storeLocation = searchParams.get("location")?.trim() || "KTX A";
  const roleLabel = searchParams.get("role")?.trim() || "Nhân viên (Staff)";

  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  function handleSubmitRequest() {
    if (submitting || showSuccessModal) return;
    setSubmitting(true);

    window.setTimeout(() => {
      setSubmitting(false);
      setShowSuccessModal(true);
    }, 350);
  }

  function handleReturnToProfile() {
    router.push("/account");
  }

  return (
    <div className={styles.confirmViewport}>
      <div className={styles.confirmContainer}>
        <header className={styles.confirmHeader}>
          <Link
            href="/account/join-store"
            className={styles.confirmBackBtn}
            aria-label="Quay lại màn hình quét mã QR"
          >
            <ArrowLeft size={26} strokeWidth={2.2} aria-hidden="true" />
          </Link>

          <div className={styles.confirmHeaderCopy}>
            <h1>
              Xác nhận <span>gia nhập</span>
            </h1>
            <p>Kiểm tra thông tin cửa hàng trước khi gửi yêu cầu.</p>
          </div>
        </header>

        <section
          className={styles.confirmCard}
          aria-labelledby="qr-success-heading"
        >
          <div className={styles.successHero}>
            <span className={styles.successCircleOuter} aria-hidden="true">
              <CircleCheck size={44} strokeWidth={2.2} />
            </span>

            <h2 id="qr-success-heading">Quét QR thành công!</h2>
            <p>Đã xác thực mã QR của cửa hàng StudentFood.</p>
          </div>

          <div className={styles.storeProfileRow}>
            <div className={styles.storeThumb}>
              <StoreRiceBowlArtwork />
            </div>

            <div className={styles.storeInfoCopy}>
              <h3>{storeName}</h3>

              <span className={styles.storeLocation}>
                <MapPin size={17} strokeWidth={2} aria-hidden="true" />
                {storeLocation}
              </span>

              <span className={styles.validQrPill}>
                <CircleCheck size={16} strokeWidth={2.3} aria-hidden="true" />
                QR hợp lệ
              </span>
            </div>
          </div>

          <div className={styles.detailsBox}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Cửa hàng</span>
              <strong className={styles.detailValue}>{storeName}</strong>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Khu vực</span>
              <strong className={styles.detailValue}>{storeLocation}</strong>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Vai trò xin gia nhập</span>
              <strong className={styles.detailValue}>{roleLabel}</strong>
            </div>
          </div>

          <div className={styles.confirmNoticeBox} role="note">
            <CircleAlert
              size={20}
              strokeWidth={2.2}
              className={styles.confirmNoticeIcon}
              aria-hidden="true"
            />
            <span>
              Yêu cầu của bạn sẽ được gửi đến chủ quán. Bạn chỉ có quyền nhân
              viên sau khi được chấp nhận.
            </span>
          </div>
        </section>

        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.submitJoinBtn}
            disabled={submitting}
            onClick={handleSubmitRequest}
          >
            <span>
              {submitting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu gia nhập"}
            </span>
            <ArrowRight size={20} strokeWidth={2.3} aria-hidden="true" />
          </button>

          <button
            type="button"
            className={styles.cancelJoinBtn}
            onClick={handleReturnToProfile}
          >
            Hủy bỏ
          </button>
        </div>
      </div>

      {showSuccessModal && (
        <div
          className={styles.sentModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sent-request-title"
        >
          <div className={styles.sentModalCard}>
            <div className={styles.sentIllustration} aria-hidden="true">
              <span
                className={`${styles.confettiPiece} ${styles.confettiLeftTop}`}
              />
              <span
                className={`${styles.confettiPiece} ${styles.confettiLeftMid}`}
              />
              <span
                className={`${styles.confettiPiece} ${styles.confettiLeftBottom}`}
              />

              <span className={styles.sentCircleIcon}>
                <Send size={42} strokeWidth={2.1} />
              </span>

              <span
                className={`${styles.confettiPiece} ${styles.confettiRightTop}`}
              />
              <span
                className={`${styles.confettiPiece} ${styles.confettiRightMid}`}
              />
              <span
                className={`${styles.confettiPiece} ${styles.confettiRightBottom}`}
              />
            </div>

            <h2 id="sent-request-title" className={styles.sentModalTitle}>
              Đã gửi yêu cầu!
            </h2>

            <p className={styles.sentModalDesc}>
              Yêu cầu xin làm nhân viên tại {storeName} đã được gửi đến chủ
              quán.
            </p>

            <span className={styles.pendingApprovalPill}>
              <Clock3 size={16} strokeWidth={2.2} aria-hidden="true" />
              Đang chờ phê duyệt
            </span>

            <div className={styles.sentModalInfoBox} role="note">
              <CircleAlert
                size={19}
                strokeWidth={2.2}
                className={styles.sentModalInfoIcon}
                aria-hidden="true"
              />
              <span>
                Bạn sẽ nhận được thông báo khi chủ quán chấp nhận hoặc từ chối
                yêu cầu.
              </span>
            </div>

            <button
              type="button"
              className={styles.sentModalBtn}
              onClick={handleReturnToProfile}
              autoFocus
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
