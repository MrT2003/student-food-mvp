"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ArrowLeft,
  Camera,
  CircleAlert,
  Image as ImageIcon,
  ScanQrCode,
  SwitchCamera,
  Zap,
} from "lucide-react";
import styles from "@/styles/account-join-store-qr.module.css";

function SampleStandeeQr() {
  return (
    <div className={styles.standeeCard} aria-hidden="true">
      <svg
        viewBox="0 0 120 120"
        className={styles.standeeQrSvg}
        fill="#0b1536"
      >
        {/* Top-left finder */}
        <path d="M6 6h34v34H6V6zm6 6v22h22V12H12zm5 5h12v12H17V17z" />
        {/* Top-right finder */}
        <path d="M80 6h34v34H80V6zm6 6v22h22V12H86zm5 5h12v12H91V17z" />
        {/* Bottom-left finder */}
        <path d="M6 80h34v34H6V80zm6 6v22h22V86H12zm5 5h12v12H17V91z" />
        {/* Data modules */}
        <rect x="46" y="6" width="6" height="6" />
        <rect x="58" y="6" width="6" height="12" />
        <rect x="70" y="12" width="6" height="6" />
        <rect x="46" y="18" width="12" height="6" />
        <rect x="64" y="24" width="10" height="6" />
        <rect x="46" y="30" width="6" height="10" />
        <rect x="58" y="34" width="6" height="6" />
        <rect x="6" y="46" width="12" height="6" />
        <rect x="24" y="46" width="6" height="12" />
        <rect x="36" y="52" width="12" height="6" />
        <rect x="54" y="46" width="12" height="12" />
        <rect x="72" y="46" width="6" height="6" />
        <rect x="84" y="46" width="12" height="6" />
        <rect x="102" y="46" width="12" height="12" />
        <rect x="12" y="58" width="6" height="12" />
        <rect x="30" y="64" width="12" height="6" />
        <rect x="48" y="62" width="6" height="12" />
        <rect x="60" y="64" width="12" height="6" />
        <rect x="78" y="58" width="6" height="12" />
        <rect x="90" y="58" width="12" height="6" />
        <rect x="108" y="64" width="6" height="12" />
        <rect x="46" y="80" width="12" height="6" />
        <rect x="64" y="76" width="6" height="12" />
        <rect x="76" y="80" width="12" height="6" />
        <rect x="94" y="76" width="12" height="12" />
        <rect x="46" y="92" width="6" height="12" />
        <rect x="58" y="92" width="12" height="6" />
        <rect x="76" y="92" width="6" height="12" />
        <rect x="88" y="94" width="12" height="6" />
        <rect x="106" y="90" width="8" height="12" />
        <rect x="54" y="106" width="12" height="8" />
        <rect x="72" y="108" width="12" height="6" />
        <rect x="92" y="106" width="10" height="8" />
        <rect x="108" y="108" width="6" height="6" />
      </svg>
      <div className={styles.standeeBrand}>
        Student<span>Food</span>
      </div>
    </div>
  );
}

export default function JoinStoreQrScanView() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [torchOn, setTorchOn] = useState(false);
  const [hasLiveCamera, setHasLiveCamera] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let cancelled = false;

    async function startCamera() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasLiveCamera(true);
        }
      } catch {
        setHasLiveCamera(false);
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  useEffect(() => {
    return () => {
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }
    };
  }, [previewImageUrl]);

  async function handleToggleTorch() {
    const nextTorch = !torchOn;
    setTorchOn(nextTorch);

    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()?.[0];
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
    } catch {
      // Thiết bị không hỗ trợ đèn flash trên trình duyệt sẽ chỉ đổi trạng thái nút
    }
  }

  function handleSwitchCamera() {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

  function goToConfirmScreen() {
    router.push("/account/join-store/confirm");
  }

  function handleSelectQrImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewImageUrl(objectUrl);
    setStatusMessage("Đã nhận diện mã QR hợp lệ! Đang chuyển sang xác nhận...");

    window.setTimeout(() => {
      router.push("/account/join-store/confirm");
    }, 650);
  }

  return (
    <div className={styles.scannerViewport}>
      <video
        ref={videoRef}
        className={styles.cameraStream}
        autoPlay
        playsInline
        muted
        hidden={!hasLiveCamera}
      />
      <div className={styles.cameraBackdropOverlay} aria-hidden="true" />

      <div className={styles.scannerContainer}>
        <div className={styles.topSection}>
          <div className={styles.navBar}>
            <Link
              href="/account"
              className={styles.backButton}
              aria-label="Quay lại tài khoản"
            >
              <ArrowLeft size={26} strokeWidth={2.2} aria-hidden="true" />
            </Link>

            <button
              type="button"
              className={styles.helpButton}
              aria-label="Hướng dẫn quét mã QR xin việc"
              onClick={() =>
                setStatusMessage(
                  "Mẹo test nhanh: Nhấn vào khung QR giữa màn hình hoặc chọn bất kỳ ảnh nào để sang trang Xác nhận gia nhập.",
                )
              }
            >
              ?
            </button>
          </div>

          <div className={styles.headerRow}>
            <span className={styles.qrHeaderBadge} aria-hidden="true">
              <ScanQrCode size={30} strokeWidth={2.2} />
            </span>

            <div className={styles.headerCopy}>
              <h1>Quét QR xin việc</h1>
              <p>Quét mã QR từ chủ quán để gửi yêu cầu xin làm nhân viên.</p>
            </div>
          </div>
        </div>

        <div className={styles.centerSection}>
          <div className={styles.cameraControlsRow}>
            <button
              type="button"
              className={`${styles.circleControlBtn} ${
                torchOn ? styles.circleControlBtnActive : ""
              }`}
              aria-label="Bật hoặc tắt đèn flash"
              aria-pressed={torchOn}
              onClick={() => void handleToggleTorch()}
            >
              <Zap size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>

            <button
              type="button"
              className={styles.circleControlBtn}
              aria-label="Đổi camera trước hoặc sau"
              onClick={handleSwitchCamera}
            >
              <SwitchCamera size={22} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Mô phỏng quét mã QR thành công"
            title="Nhấn để mô phỏng quét mã QR thành công"
            className={`${styles.viewfinderFrame} ${styles.viewfinderInteractive}`}
            onClick={goToConfirmScreen}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                goToConfirmScreen();
              }
            }}
          >
            <span
              className={`${styles.corner} ${styles.cornerTopLeft}`}
              aria-hidden="true"
            />
            <span
              className={`${styles.corner} ${styles.cornerTopRight}`}
              aria-hidden="true"
            />
            <span
              className={`${styles.corner} ${styles.cornerBottomLeft}`}
              aria-hidden="true"
            />
            <span
              className={`${styles.corner} ${styles.cornerBottomRight}`}
              aria-hidden="true"
            />

            {previewImageUrl ? (
              <img
                src={previewImageUrl}
                alt="Ảnh mã QR đã chọn"
                className={styles.uploadedPreviewImg}
              />
            ) : !hasLiveCamera ? (
              <SampleStandeeQr />
            ) : null}
          </div>

          <div className={styles.guidePill}>Đưa mã QR vào giữa khung hình</div>

          <div className={styles.autoScanRow}>
            <span className={styles.autoScanBadge} aria-hidden="true">
              <Camera size={13} strokeWidth={2.3} />
            </span>
            <span>Camera sẽ quét tự động khi nhận diện mã</span>
          </div>
        </div>

        <div className={styles.bottomSection}>
          {statusMessage && (
            <p className={styles.statusBanner} role="status">
              {statusMessage}
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleSelectQrImage}
          />

          <button
            type="button"
            className={styles.uploadQrBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon size={22} strokeWidth={2.1} aria-hidden="true" />
            <span>Chọn ảnh QR từ thiết bị</span>
          </button>

          <div className={styles.warningCard} role="note">
            <CircleAlert
              size={22}
              strokeWidth={2.2}
              className={styles.warningIcon}
              aria-hidden="true"
            />
            <span>
              Chỉ quét mã QR gia nhập cửa hàng StudentFood. Không sử dụng mã QR
              thanh toán.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
