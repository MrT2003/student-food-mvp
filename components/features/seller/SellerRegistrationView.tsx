"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  Banknote,
  ClipboardList,
  ImagePlus,
  Info,
  Landmark,
  MapPin,
  Store,
  Wallet,
  Zap,
} from "lucide-react";

import styles from "@/styles/seller-registration.module.css";

type ScheduleMode = "same" | "daily" | "later";

type DayHours = {
  id: string;
  label: string;
  enabled: boolean;
  open: string;
  close: string;
};

const initialDays: DayHours[] = [
  { id: "mon", label: "T2", enabled: true, open: "10:00", close: "14:00" },
  { id: "tue", label: "T3", enabled: true, open: "10:00", close: "14:00" },
  { id: "wed", label: "T4", enabled: true, open: "10:00", close: "14:00" },
  { id: "thu", label: "T5", enabled: true, open: "10:00", close: "14:00" },
  { id: "fri", label: "T6", enabled: true, open: "10:00", close: "14:00" },
  { id: "sat", label: "T7", enabled: true, open: "10:00", close: "14:00" },
  { id: "sun", label: "CN", enabled: true, open: "10:00", close: "14:00" },
];

const benefits = [
  {
    icon: Zap,
    title: "Tạo cửa hàng nhanh chóng",
    description: "Chỉ vài bước đơn giản để bắt đầu bán hàng.",
  },
  {
    icon: Store,
    title: "Quản lý menu dễ dàng",
    description: "Thêm món ăn, chỉnh sửa giá và hình ảnh linh hoạt.",
  },
  {
    icon: ClipboardList,
    title: "Theo dõi đơn hàng",
    description: "Nhận và xử lý đơn hàng tập trung trên một dashboard.",
  },
  {
    icon: Wallet,
    title: "Nhận thanh toán linh hoạt",
    description: "Hỗ trợ tiền mặt và chuyển khoản.",
  },
];

export default function SellerRegistrationView() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("same");
  const [openTime, setOpenTime] = useState("10:00");
  const [closeTime, setCloseTime] = useState("14:00");
  const [days, setDays] = useState<DayHours[]>(initialDays);

  const [cash, setCash] = useState(true);
  const [bank, setBank] = useState(true);
  const [startClosed, setStartClosed] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageError, setImageError] = useState("");

  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUrlRef = useRef<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (errors.length > 0) {
      errorRef.current?.focus();
    }
  }, [errors]);

  function clearImage() {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }

    setImageFile(null);
    setImagePreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageError("");
    setMessage("");

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setImageError("Chỉ chấp nhận ảnh JPG hoặc PNG.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError("Ảnh không được vượt quá 5 MB.");
      event.target.value = "";
      return;
    }

    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
    }

    const url = URL.createObjectURL(file);
    imageUrlRef.current = url;
    setImageFile(file);
    setImagePreview(url);
  }

  function updateDay(id: string, patch: Partial<DayHours>) {
    setDays((previous) =>
      previous.map((day) => (day.id === id ? { ...day, ...patch } : day)),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const nextErrors: string[] = [];

    if (!name.trim()) {
      nextErrors.push("Vui lòng nhập tên cửa hàng.");
    }
    if (!description.trim()) {
      nextErrors.push("Vui lòng nhập mô tả ngắn.");
    }
    if (!location.trim()) {
      nextErrors.push("Vui lòng chọn hoặc nhập khu vực / địa điểm.");
    }
    if (!cash && !bank) {
      nextErrors.push("Vui lòng chọn ít nhất một phương thức thanh toán.");
    }
    if (imageError) {
      nextErrors.push("Vui lòng chọn lại ảnh hợp lệ hoặc bỏ chọn ảnh.");
    }

    const enabledDays = days.filter((day) => day.enabled);

    if (scheduleMode !== "later" && enabledDays.length === 0) {
      nextErrors.push("Vui lòng chọn ít nhất một ngày hoạt động.");
    }

    if (scheduleMode === "same") {
      if (!openTime || !closeTime || openTime >= closeTime) {
        nextErrors.push("Giờ đóng cửa phải sau giờ mở cửa trong cùng ngày.");
      }
    }

    if (scheduleMode === "daily") {
      const invalidDays = enabledDays.filter(
        (day) => !day.open || !day.close || day.open >= day.close,
      );

      if (invalidDays.length > 0) {
        nextErrors.push(
          `Kiểm tra giờ hoạt động của ${invalidDays
            .map((day) => day.label)
            .join(", ")}: giờ đóng phải sau giờ mở trong cùng ngày.`,
        );
      }
    }

    setErrors(nextErrors);
    if (nextErrors.length > 0) return;

    // Điểm tích hợp API tạo cửa hàng sau này.
    // Chưa upload ảnh, lưu database hoặc thay đổi quyền tài khoản.
    setMessage(
      `Thông tin cửa hàng "${name.trim()}" hợp lệ ở phía frontend. ` +
        "Đây là bản xem trước: chưa tạo cửa hàng, chưa tải ảnh lên " +
        "và chưa chuyển sang Seller Dashboard.",
    );
  }

  return (
    <div className={styles.page} data-schedule={scheduleMode}>
      <aside className={styles.intro}>
        <span className={styles.studentBadge}>Dành cho sinh viên</span>

        <h1>
          Bắt đầu bán hàng cùng
          <br />
          <span>StudentFood</span>
        </h1>

        <p className={styles.introText}>
          Tài khoản sinh viên của bạn có thể tạo cửa hàng và bắt đầu kinh doanh,
          phục vụ cộng đồng sinh viên trên toàn quốc.
        </p>

        <ul className={styles.benefits}>
          {benefits.map(({ icon: Icon, title, description: text }) => (
            <li key={title}>
              <span className={styles.benefitIcon}>
                <Icon size={31} aria-hidden="true" />
              </span>
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className={styles.bankNotice}>
          <Info size={27} aria-hidden="true" />
          <div>
            <strong>Bạn có thể thêm thông tin ngân hàng sau</strong>
            <p>
              Nếu chọn chuyển khoản, hệ thống sẽ yêu cầu cấu hình tài khoản ở
              bước tiếp theo hoặc trong phần cài đặt cửa hàng.
            </p>
          </div>
        </div>
      </aside>

      <section className={styles.formCard} aria-labelledby="shop-form-title">
        <header className={styles.formHeading}>
          <h2 id="shop-form-title">Thông tin cửa hàng</h2>
          <p>Điền thông tin cơ bản để tạo cửa hàng của bạn trên StudentFood.</p>
        </header>

        <form
          onSubmit={handleSubmit}
          onChange={() => setMessage("")}
          noValidate
          className={styles.form}
        >
          <div className={styles.field}>
            <label htmlFor="shop-name">
              Tên cửa hàng <span>*</span>
            </label>
            <input
              id="shop-name"
              name="name"
              required
              maxLength={100}
              placeholder="Ví dụ: Cơm Cô Ba"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="shop-description">
              Mô tả ngắn <span>*</span>
            </label>
            <div className={styles.textareaWrap}>
              <textarea
                id="shop-description"
                name="description"
                required
                maxLength={300}
                rows={3}
                placeholder="Giới thiệu ngắn về quán, món ăn, phong cách của bạn..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                aria-describedby="description-count"
              />
              <span id="description-count" className={styles.counter}>
                {description.length}/300
              </span>
            </div>
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.field}>
              <label htmlFor="shop-location">
                Khu vực / địa điểm <span>*</span>
              </label>

              <div className={styles.locationInput}>
                <MapPin size={23} aria-hidden="true" />
                <input
                  id="shop-location"
                  name="location"
                  list="shop-locations"
                  required
                  maxLength={200}
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Chọn khu vực hoặc nhập địa điểm"
                />
              </div>

              <datalist id="shop-locations">
                <option value="KTX A" />
                <option value="KTX B" />
              </datalist>

              <p className={styles.hint}>Ví dụ: KTX A, Q. Thủ Đức, TP. HCM</p>
            </div>

            <div className={styles.field}>
              <div className={styles.uploadHeading}>
                <label htmlFor="shop-image">Ảnh đại diện quán</label>
                <span>Không bắt buộc</span>
              </div>

              <input
                ref={fileInputRef}
                id="shop-image"
                type="file"
                accept="image/jpeg,image/png"
                className={styles.srOnly}
                onChange={handleImageChange}
                aria-describedby="image-help image-error"
              />

              <button
                type="button"
                className={styles.upload}
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Ảnh đại diện quán đã chọn"
                      className={styles.imagePreview}
                      onError={() => {
                        clearImage();
                        setImageError("Không đọc được ảnh. Hãy chọn ảnh khác.");
                      }}
                    />
                    <span>Nhấn để thay ảnh</span>
                  </>
                ) : (
                  <>
                    <ImagePlus size={26} aria-hidden="true" />
                    <span>Nhấn để tải ảnh lên</span>
                    <small>JPG, PNG, tối đa 5MB</small>
                  </>
                )}
              </button>

              {(imageFile || imageError) && (
                <button
                  type="button"
                  className={styles.removeImage}
                  onClick={() => {
                    clearImage();
                    setImageError("");
                    setMessage("");
                  }}
                >
                  Bỏ chọn ảnh
                </button>
              )}

              <p id="image-error" className={styles.errorText} role="alert">
                {imageError}
              </p>
              <p id="image-help" className={styles.hint}>
                Bạn có thể thay đổi hình ảnh này sau trong phần cài đặt.
              </p>
            </div>
          </div>

          <fieldset className={styles.fieldset}>
            <legend>
              Giờ hoạt động <span>*</span>
            </legend>

            <div className={styles.radioGroup}>
              {[
                { value: "same", label: "Giống nhau mỗi ngày" },
                { value: "daily", label: "Thiết lập theo từng ngày" },
                { value: "later", label: "Thiết lập sau" },
              ].map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="schedule-mode"
                    value={option.value}
                    checked={scheduleMode === option.value}
                    onChange={() =>
                      setScheduleMode(option.value as ScheduleMode)
                    }
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {scheduleMode === "same" && (
              <div className={styles.sameSchedule}>
                <label className={styles.timeField}>
                  Giờ mở cửa
                  <input
                    type="time"
                    value={openTime}
                    onChange={(event) => setOpenTime(event.target.value)}
                  />
                </label>

                <label className={styles.timeField}>
                  Giờ đóng cửa
                  <input
                    type="time"
                    value={closeTime}
                    onChange={(event) => setCloseTime(event.target.value)}
                  />
                </label>

                <div className={styles.dayPicker}>
                  <strong>Áp dụng cho các ngày</strong>
                  <div>
                    {days.map((day) => (
                      <label key={day.id}>
                        <input
                          type="checkbox"
                          checked={day.enabled}
                          onChange={(event) =>
                            updateDay(day.id, { enabled: event.target.checked })
                          }
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {scheduleMode === "daily" && (
              <div className={styles.dailySchedule}>
                {days.map((day) => (
                  <div className={styles.dayRow} key={day.id}>
                    <label className={styles.dayToggle}>
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(event) =>
                          updateDay(day.id, { enabled: event.target.checked })
                        }
                      />
                      {day.label}
                    </label>

                    <input
                      type="time"
                      aria-label={`Giờ mở cửa ${day.label}`}
                      disabled={!day.enabled}
                      value={day.open}
                      onChange={(event) =>
                        updateDay(day.id, { open: event.target.value })
                      }
                    />

                    <span>đến</span>

                    <input
                      type="time"
                      aria-label={`Giờ đóng cửa ${day.label}`}
                      disabled={!day.enabled}
                      value={day.close}
                      onChange={(event) =>
                        updateDay(day.id, { close: event.target.value })
                      }
                    />

                    {!day.enabled && <small>Nghỉ</small>}
                  </div>
                ))}
              </div>
            )}

            {scheduleMode === "later" && (
              <p className={styles.laterNotice}>
                Chưa thiết lập lịch hoạt động. Bạn có thể bổ sung trong phần Cài
                đặt cửa hàng.
              </p>
            )}

            <p className={styles.hint}>
              Bạn có thể thiết lập nhiều khung giờ hoặc lịch chi tiết hơn sau
              trong Cài đặt cửa hàng.
            </p>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>
              Phương thức thanh toán <span>*</span>
            </legend>

            <div className={styles.paymentGrid}>
              <label className={styles.paymentCard}>
                <input
                  type="checkbox"
                  checked={cash}
                  onChange={(event) => setCash(event.target.checked)}
                />
                <span className={styles.cashIcon}>
                  <Banknote size={26} aria-hidden="true" />
                </span>
                <span>
                  <strong>Tiền mặt</strong>
                  <small>Khách hàng thanh toán khi nhận hàng.</small>
                </span>
              </label>

              <label className={styles.paymentCard}>
                <input
                  type="checkbox"
                  checked={bank}
                  onChange={(event) => setBank(event.target.checked)}
                />
                <span className={styles.bankIcon}>
                  <Landmark size={26} aria-hidden="true" />
                </span>
                <span>
                  <strong>Chuyển khoản</strong>
                  <small>
                    Thông tin tài khoản ngân hàng sẽ được thiết lập sau.
                  </small>
                </span>
              </label>
            </div>
          </fieldset>

          <label className={styles.closedOption}>
            <input
              type="checkbox"
              role="switch"
              checked={startClosed}
              onChange={(event) => setStartClosed(event.target.checked)}
              className={styles.switchInput}
            />
            <span>
              <strong>Tôi muốn bắt đầu ở trạng thái tạm đóng</strong>
              <small>Bạn có thể mở cửa hàng sau khi tạo xong.</small>
            </span>
          </label>

          {errors.length > 0 && (
            <div
              ref={errorRef}
              tabIndex={-1}
              className={styles.errorBox}
              role="alert"
            >
              <strong>Vui lòng kiểm tra thông tin:</strong>
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {message && (
            <p className={styles.previewNotice} role="status">
              {message}
            </p>
          )}

          <div className={styles.actions}>
            <Link href="/account" className={styles.outlineButton}>
              Quay lại
            </Link>
            <button type="submit" className={styles.primaryButton}>
              Tạo cửa hàng
              <ArrowRight size={21} aria-hidden="true" />
            </button>
          </div>

          <p className={styles.footerNote}>
            Sau khi tạo cửa hàng, bạn sẽ được chuyển đến Seller Dashboard để
            quản lý cửa hàng.
          </p>
          <p className={styles.previewLabel}>
            Bản UI mẫu: chưa lưu dữ liệu hoặc chuyển trang.
          </p>
        </form>
      </section>
    </div>
  );
}
