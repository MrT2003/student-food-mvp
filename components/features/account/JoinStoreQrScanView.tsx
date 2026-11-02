"use client";

import jsQR from "jsqr";
import { holdStaffToken, parseStaffQr } from "@/lib/seller/staff-client";
import { getCurrentProfile } from "@/services/auth.service";
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

export default function JoinStoreQrScanView() {
  const router = useRouter();
  const detected = useRef(false);
  const alive = useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [torchOn, setTorchOn] = useState(false);
  const [hasLiveCamera, setHasLiveCamera] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let cancelled = false;
    let frame = 0;
    detected.current=false;
    const canvas=document.createElement("canvas"), context=canvas.getContext("2d",{willReadFrequently:true});
    function scan(){
      if(cancelled)return;
      if(detected.current){frame=requestAnimationFrame(scan);return;}
      const video=videoRef.current;
      if(video&&video.readyState>=2&&video.videoWidth&&context){
        canvas.width=video.videoWidth;canvas.height=video.videoHeight;context.drawImage(video,0,0);
        const pixels=context.getImageData(0,0,canvas.width,canvas.height);const qr=jsQR(pixels.data,pixels.width,pixels.height);
        if(qr){try{const token=parseStaffQr(qr.data);detected.current=true;activeStream?.getTracks().forEach(t=>t.stop());holdStaffToken(token);router.push("/account/join-store/confirm");return;}catch{setStatusMessage("Mã QR không được hỗ trợ.");}}
      }
      frame=requestAnimationFrame(scan);
    }

    async function startCamera() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setStatusMessage("Thiết bị chưa hỗ trợ camera. Bạn có thể chọn ảnh QR.");return;
      }

      try {
        const profile=await getCurrentProfile();if(cancelled)return;if(!profile){setStatusMessage("Vui lòng đăng nhập để quét QR.");return;}
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
          frame=requestAnimationFrame(scan);
        }
      } catch {
        if(cancelled)return;
        setStatusMessage("Không mở được camera. Kiểm tra quyền camera hoặc chọn ảnh QR.");
        setHasLiveCamera(false);
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode,router]);

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

  async function handleSelectQrImage(event: ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];event.target.value="";if(!file||detected.current)return;
    if(!file.type.startsWith("image/")||file.size>10*1024*1024){setStatusMessage("Hãy chọn ảnh QR dưới 10 MB.");return;}
    detected.current=true;let bitmap:ImageBitmap|null=null;
    try{bitmap=await createImageBitmap(file);if(!alive.current)return;
      const canvas=document.createElement("canvas");const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.floor(bitmap.width*scale));canvas.height=Math.max(1,Math.floor(bitmap.height*scale));const context=canvas.getContext("2d");if(!context)throw Error();context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height);const qr=jsQR(pixels.data,pixels.width,pixels.height);if(!qr)throw Error();
      const token=parseStaffQr(qr.data);(videoRef.current?.srcObject as MediaStream|null)?.getTracks().forEach(t=>t.stop());holdStaffToken(token);router.push("/account/join-store/confirm");
    }catch{if(alive.current){setStatusMessage("Không đọc được mã tuyển nhân viên trong ảnh.");detected.current=false;}}
    finally{bitmap?.close();}
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
                  "Mở quyền camera và đưa mã tuyển nhân viên vào khung, hoặc chọn ảnh QR.",
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
              <p>Quét mã QR từ chủ quán để gia nhập cửa hàng.</p>
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
            className={styles.viewfinderFrame}
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

            {!hasLiveCamera ? (
              <Camera size={64} aria-hidden="true" />
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
            onChange={event=>void handleSelectQrImage(event)}
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
