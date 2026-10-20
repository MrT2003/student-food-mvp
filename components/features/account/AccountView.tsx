"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Camera, Info, LogOut, Settings, UserRound } from "lucide-react";
import styles from "@/styles/account.module.css";
import AccountSuccessModal from "./AccountSuccessModal";
import AccountSecurity from "./AccountSecurity";
import { CloudinaryService } from "@/services/cloudinary.service";
import { getAuthErrorMessage, updateMyProfile } from "@/services/auth.service";
import { useAuthStore } from "@/store/useAuthStore";

const initialProfile = {
  name: "Nguyễn Văn A",
  phone: "0901 234 567",
};

export default function AccountView() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [name, setName] = useState(initialProfile.name);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name || initialProfile.name);
    setPhone(user.phone || initialProfile.phone);
    setAvatarUrl(user.avatar_url ?? null);
  }, [user]);

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setError("");
    setMessage("");

    const validationError = CloudinaryService.validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setUploadingAvatar(true);
      const uploaded = await CloudinaryService.uploadImage(file, {
        folder: "student-food/avatars",
      });
      setAvatarUrl(uploaded.secureUrl);
      setMessage(
        "Đã tải ảnh lên Cloudinary thành công. Nhấn 'Lưu thay đổi' để cập nhật hồ sơ.",
      );
    } catch (uploadErr) {
      setError(
        uploadErr instanceof Error
          ? uploadErr.message
          : "Không thể tải ảnh đại diện lên Cloudinary.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uploadingAvatar) return;

    setError("");
    setMessage("");

    const trimmedName = name.trim();
    const normalizedPhone = phone.replace(/\s/g, "");

    if (!trimmedName) {
      setError("Vui lòng nhập họ và tên.");
      return;
    }

    if (!/^(0\d{9}|\+84\d{9})$/.test(normalizedPhone)) {
      setError("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }

    setName(trimmedName);

    if (user) {
      try {
        setSaving(true);
        const updatedProfile = await updateMyProfile({
          name: trimmedName,
          phone: normalizedPhone,
          avatarUrl,
        });
        setUser(updatedProfile);
        setShowSuccessModal(true);
      } catch (saveErr) {
        setError(getAuthErrorMessage(saveErr));
      } finally {
        setSaving(false);
      }
      return;
    }

    setShowSuccessModal(true);
  }

  function showPendingMessage(action: string) {
    setError("");
    setMessage(`${action} chưa được kết nối API.`);
  }

  const avatarInitial = (name.trim()[0] || "N").toUpperCase();

  return (
    <div className={styles.accountPage}>
      <div className={styles.pageHeading}>
        <h1>
          Tài khoản <span>của tôi</span>
        </h1>
        <p>Quản lý thông tin cá nhân và bảo mật tài khoản.</p>
      </div>

      <section className={styles.card} aria-labelledby="personal-title">
        <div className={styles.sectionHeading}>
          <span className={styles.sectionIcon}>
            <UserRound size={27} aria-hidden="true" />
          </span>
          <div>
            <h2 id="personal-title">Thông tin cá nhân</h2>
            <p>Cập nhật thông tin của bạn để sử dụng dịch vụ tốt hơn.</p>
          </div>
        </div>

        <div className={styles.personalContent}>
          <div className={styles.avatarColumn}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Ảnh đại diện"
                    fill
                    unoptimized
                    sizes="134px"
                    className={styles.avatarImage}
                  />
                ) : (
                  <span>{avatarInitial}</span>
                )}
              </div>

              <button
                type="button"
                className={styles.cameraBadge}
                aria-label="Chọn ảnh đại diện"
                disabled={uploadingAvatar}
                onClick={() => fileInput.current?.click()}
              >
                <Camera size={20} aria-hidden="true" />
              </button>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleAvatarChange}
            />

            <button
              type="button"
              className={styles.outlineButton}
              disabled={uploadingAvatar}
              onClick={() => fileInput.current?.click()}
            >
              <Camera size={21} aria-hidden="true" />
              {uploadingAvatar ? "Đang tải ảnh..." : "Thay đổi ảnh"}
            </button>
          </div>

          <form className={styles.profileForm} onSubmit={handleSave}>
            <div className={styles.field}>
              <label htmlFor="account-name">Họ và tên</label>
              <input
                id="account-name"
                name="name"
                autoComplete="name"
                value={name}
                maxLength={100}
                required
                onChange={(event) => {
                  setName(event.target.value);
                  setMessage("");
                  setError("");
                }}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="account-phone">Số điện thoại</label>
              <input
                id="account-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                maxLength={20}
                required
                aria-describedby="phone-hint"
                onChange={(event) => {
                  setPhone(event.target.value);
                  setMessage("");
                  setError("");
                }}
              />

              <p id="phone-hint" className={styles.hint}>
                <Info size={16} aria-hidden="true" />
                <span>
                  Bạn có thể cập nhật số điện thoại để nhận thông báo và hỗ trợ
                  tốt hơn.
                </span>
              </p>
            </div>

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={saving || uploadingAvatar}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </form>
        </div>
      </section>

      <AccountSecurity />

      <section
        className={`${styles.card} ${styles.managementCard}`}
        aria-labelledby="management-title"
      >
        <div className={styles.sectionHeading}>
          <span className={styles.sectionIcon}>
            <Settings size={27} aria-hidden="true" />
          </span>
          <div>
            <h2 id="management-title">Quản lý tài khoản</h2>
            <p>Đăng xuất khỏi tài khoản trên thiết bị này.</p>
          </div>
        </div>

        <button
          type="button"
          className={styles.outlineButton}
          onClick={() => showPendingMessage("Chức năng đăng xuất")}
        >
          <LogOut size={21} aria-hidden="true" />
          Đăng xuất
        </button>
      </section>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className={styles.feedback} role="status">
          {message}
        </p>
      )}

      <AccountSuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />
    </div>
  );
}
