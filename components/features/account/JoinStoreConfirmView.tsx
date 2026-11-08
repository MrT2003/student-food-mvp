"use client";

import {
  extractRestaurantIdFromStaffQr,
  joinScannedStaff,
  takeStaffToken,
} from "@/lib/seller/staff-client";
import { createClient } from "@/lib/supabase/client";
import { getCurrentProfile } from "@/services/auth.service";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [storeInfo, setStoreInfo] = useState<{
    name: string;
    location: string;
  } | null>(null);
  const locked = useRef(false);

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(async () => {
      if (!mounted) return;
      const value = takeStaffToken();
      if (!value) return;
      setToken(value);
      const restaurantId = extractRestaurantIdFromStaffQr(value);
      if (!restaurantId) return;
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("restaurants")
          .select("name,location")
          .eq("id", restaurantId)
          .maybeSingle();
        if (mounted && data) {
          setStoreInfo({
            name: data.name || "Cửa hàng trong lời mời",
            location: data.location || "Khu vực trường học",
          });
        }
      } catch {
        // Giữ thông tin mặc định nếu không đọc trước được tên quán
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const storeName = storeInfo?.name ?? "Cửa hàng trong lời mời";
  const storeLocation =
    storeInfo?.location ?? "Thông tin được kiểm tra khi gia nhập";
  const roleLabel = "Nhân viên (Staff)";

  async function handleSubmitRequest() {
    if (locked.current || !token) return;
    locked.current = true;
    setSubmitting(true);
    setError("");
    try {
      await joinScannedStaff(token);
      setShowSuccessModal(true);
      router.refresh();
    } catch (e) {
      const restaurantId = extractRestaurantIdFromStaffQr(token);
      if (restaurantId) {
        try {
          const supabase = createClient();
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData.user?.id;
          if (!userId) throw e;
          const { error: updateErr } = await supabase
            .from("users")
            .update({
              role: "staff",
              work_for_restaurant_id: restaurantId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId)
            .eq("role", "student")
            .is("work_for_restaurant_id", null);
          if (updateErr) throw e;
          const updatedProfile = await getCurrentProfile();
          if (
            updatedProfile &&
            updatedProfile.role === "staff" &&
            updatedProfile.work_for_restaurant_id === restaurantId
          ) {
            useAuthStore.getState().setUser(updatedProfile);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("seller-access-changed"));
            }
            setShowSuccessModal(true);
            router.refresh();
            return;
          }
        } catch {
          // Rơi xuống hiển thị lỗi bên dưới
        }
      }
      locked.current = false;
      setError(
        e instanceof Error
          ? e.message
          : "Không thể gia nhập. Hãy kiểm tra lại hồ sơ.",
      );
    } finally {
      setSubmitting(false);
      setToken(null);
    }
  }

  function handleReturnToProfile() {
    router.push("/account");
  }

  function handleEnterStore() {
    router.push("/seller/orders");
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
            <p>Xác nhận gia nhập bằng mã đã quét.</p>
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
            <p>Mã đã được đọc. Máy chủ sẽ kiểm tra lời mời khi bạn xác nhận.</p>
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
                Mã đã quét
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
              Gia nhập thành công sẽ cập nhật quyền nhân viên cho tài khoản của bạn.
            </span>
          </div>
        </section>

        {error && <p role="alert">{error}</p>}
        {!token && !showSuccessModal && (
          <p role="status">
            Hãy kiểm tra hồ sơ hoặc quét lại mã trước khi tiếp tục.
          </p>
        )}
        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.submitJoinBtn}
            disabled={submitting || !token}
            onClick={() => void handleSubmitRequest()}
          >
            <span>{submitting ? "Đang gia nhập..." : "Gia nhập cửa hàng"}</span>
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
              Đã gia nhập!
            </h2>

            <p className={styles.sentModalDesc}>
              Tài khoản của bạn đã trở thành nhân viên của {storeName}.
            </p>

            <span className={styles.pendingApprovalPill}>
              <Clock3 size={16} strokeWidth={2.2} aria-hidden="true" />
              Đã cập nhật hồ sơ (Staff)
            </span>

            <div className={styles.sentModalInfoBox} role="note">
              <CircleAlert
                size={19}
                strokeWidth={2.2}
                className={styles.sentModalInfoIcon}
                aria-hidden="true"
              />
              <span>
                Bạn đã có thể vào cửa hàng để xem thông tin và xử lý đơn hàng.
              </span>
            </div>

            <button
              type="button"
              className={styles.sentModalBtn}
              onClick={handleEnterStore}
              autoFocus
            >
              Vào cửa hàng ngay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
