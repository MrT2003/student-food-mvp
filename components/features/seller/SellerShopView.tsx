"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Camera,
  CircleAlert,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  Phone,
  QrCode,
  Settings,
  Store,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import { useSellerPreviewStore } from "@/store/useSellerPreviewStore";
import {
  useSellerShopStore,
  type SellerShopPreview,
} from "@/store/useSellerShopStore";
import { useSellerMenuStore } from "@/store/useSellerMenuStore";
import { demoSellerRestaurant } from "@/lib/mocks/seller-orders.mock";
import { CloudinaryService } from "@/services/cloudinary.service";
import shell from "@/styles/seller-menu.module.css";
import styles from "@/styles/seller-shop.module.css";

export default function SellerShopView() {
  const shop = useSellerShopStore((state) => state.shop);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    Promise.resolve(useSellerPreviewStore.persist.rehydrate()).then(() => {
      if (!mounted) return;
      useSellerShopStore
        .getState()
        .initialize(useSellerPreviewStore.getState().draft);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return (
    <div className={`${shell.page} ${styles.page}`}>
      <StudentHeader variant="seller" />
      <div className={styles.workspace}>
        <SellerSidebar
          active="shop"
          name={shop?.name || demoSellerRestaurant.name}
        />
        {ready && shop ? (
          <ShopForm initial={shop} />
        ) : (
          <main className={styles.card}>Đang tải thông tin cửa hàng…</main>
        )}
      </div>
    </div>
  );
}

function ShopForm({ initial }: { initial: SellerShopPreview }) {
  const shop = useSellerShopStore((state) => state.shop) ?? initial;
  const update = useSellerShopStore((state) => state.update);
  const rows = useSellerMenuStore((state) => state.rows);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [location, setLocation] = useState(initial.location);
  const [phone, setPhone] = useState(initial.contactPhonePreview);
  const [avatar, setAvatar] = useState(initial.avatar_url);
  const [days, setDays] = useState(initial.daysPreview);
  const [mode, setMode] = useState(initial.scheduleModePreview);
  const [opens, setOpens] = useState(initial.daysPreview[0].opens);
  const [closes, setCloses] = useState(initial.daysPreview[0].closes);
  const [open, setOpen] = useState(initial.openPreview);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [manage, setManage] = useState(false);
  const [showStaffQrModal, setShowStaffQrModal] = useState(false);
  const [showStaffRequestsModal, setShowStaffRequestsModal] = useState(false);
  const [staffRequests, setStaffRequests] = useState([
    {
      id: "req-1",
      name: "Nguyễn Văn A",
      initial: "A",
      phone: "0901 234 567",
      requestedAt: "Hôm nay, 10:24",
    },
    {
      id: "req-2",
      name: "Trần Minh Anh",
      initial: "M",
      phone: "0987 654 321",
      requestedAt: "Hôm nay, 09:15",
    },
  ]);
  const [demoToken, setDemoToken] = useState("");
  const [tokenUpdated, setTokenUpdated] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const uploadRequestId = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (manage) dialog.current?.showModal();
  }, [manage]);
  const restaurantPath = `/restaurants/${demoSellerRestaurant.slug}`;
  const schedule = days.map((day) =>
    mode === "same" ? { ...day, opens, closes } : day,
  );
  const weekdays = schedule.slice(0, 5);
  const sameWeekdays = weekdays.every((day) => day.enabled === weekdays[0].enabled &&
    (!day.enabled || (day.opens === weekdays[0].opens && day.closes === weekdays[0].closes)));
  const previewDays = sameWeekdays ? [{ ...weekdays[0], label: "T2 - T6" }, ...schedule.slice(5)] : schedule;
  const timeChoices = [...new Set([...Array.from({ length: 96 }, (_, index) =>
    `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`), opens, closes])].sort();
  const locations = [
    ...new Set(["KTX A", "KTX B", "KTX C", initial.location].filter(Boolean)),
  ];

  function message(value: string) {
    setError("");
    setNotice(value);
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      message("Đã sao chép liên kết demo.");
    } catch {
      setError(
        "Không thể sao chép tự động. Bạn có thể chọn và sao chép đường dẫn đang hiển thị.",
      );
    }
  }
  async function readAvatar(file?: File) {
    if (!file) return;
    const requestId = ++uploadRequestId.current;
    setReading(true);
    setError("");
    try {
      const uploaded = await CloudinaryService.uploadImage(file, {
        folder: "student-food/restaurants",
      });
      if (uploadRequestId.current === requestId) {
        setAvatar(uploaded.secureUrl);
      }
    } catch (err) {
      if (uploadRequestId.current === requestId) {
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải ảnh đại diện lên Cloudinary.",
        );
      }
    } finally {
      if (uploadRequestId.current === requestId) {
        setReading(false);
      }
    }
  }
  function saveInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedPhone = phone.replace(/[\s.-]/g, "");
    if (
      !name.trim() ||
      !description.trim() ||
      !/^(0\d{9}|\+84\d{9})$/.test(cleanedPhone)
    ) {
      setError(
        "Nhập tên, mô tả và số điện thoại Việt Nam hợp lệ (10 số hoặc +84). ",
      );
      return;
    }
    update({
      name: name.trim(),
      description: description.trim(),
      location,
      contactPhonePreview: cleanedPhone,
      avatar_url: avatar,
    });
    const draft = useSellerPreviewStore.getState().draft;
    if (draft)
      useSellerPreviewStore
        .getState()
        .registerPreview({
          ...draft,
          name: name.trim(),
          description: description.trim(),
          location,
          avatar_url: avatar,
        });
    message("Đã lưu thông tin trong bản demo, chưa ghi database.");
  }
  function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schedule.some((day) => day.enabled)) {
      setError("Chọn ít nhất một ngày hoạt động.");
      return;
    }
    if (
      schedule.some(
        (day) =>
          day.enabled && (!day.opens || !day.closes || day.opens >= day.closes),
      )
    ) {
      setError("Giờ đóng phải sau giờ mở. Demo hiện chưa hỗ trợ lịch qua đêm.");
      return;
    }
    update({ daysPreview: schedule, scheduleModePreview: mode });
    const draft = useSellerPreviewStore.getState().draft;
    if (draft)
      useSellerPreviewStore
        .getState()
        .registerPreview({
          ...draft,
          hours: mode === "same" ? `${opens} - ${closes}` : "Theo từng ngày",
        });
    message("Đã lưu lịch hoạt động trong bản demo.");
  }
  function toggleOperatingStatus() {
    const nextOpen = !open;
    if (
      nextOpen &&
      !rows.some(({ item }) => item.is_active && item.is_available)
    ) {
      setError("Cần ít nhất một món đang hiển thị và đang bán để mở nhận đơn.");
      return;
    }
    setOpen(nextOpen);
    update({ openPreview: nextOpen });
    message(
      nextOpen
        ? "Đã mở nhận đơn trong bản demo."
        : "Đã tạm ngừng nhận đơn trong bản demo.",
    );
  }

  return (
    <main className={styles.main}>
      <header className={styles.heading}>
        <div>
          <h1>Cửa hàng</h1>
          <p>Quản lý thông tin và trạng thái hoạt động của cửa hàng bạn.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.badge} data-open={shop.openPreview}>
            ● {shop.openPreview ? "Đang nhận đơn" : "Tạm ngừng nhận đơn"}
          </span>
          <Link href={restaurantPath} className={styles.neutral}>
            <ExternalLink size={18} />
            Xem trang quán
          </Link>
          <button
            className={styles.neutral}
            onClick={() =>
              void copy(`${window.location.origin}${restaurantPath}`)
            }
          >
            <Copy size={18} />
            Sao chép link quán
          </button>
        </div>
      </header>
      {(error || notice) && (
        <p
          className={error ? styles.error : styles.notice}
          role={error ? "alert" : "status"}
        >
          {error || notice}
        </p>
      )}
      <section className={styles.card}>
        <h2>Thông tin cửa hàng</h2>
        <form onSubmit={saveInfo} className={styles.info}>
          <div className={styles.avatarField}>
            <button
              type="button"
              className={styles.avatar}
              aria-label="Thay ảnh đại diện cửa hàng"
              onClick={() => upload.current?.click()}
            >
              {avatar ? (
                <Image
                  src={avatar}
                  alt="Ảnh đại diện cửa hàng"
                  width={150}
                  height={150}
                  unoptimized
                />
              ) : (
                <Image src="/seller-store-placeholder.svg" alt="Ảnh minh họa cửa hàng" width={150} height={150} />
              )}
              <span>
                <Camera size={21} />
              </span>
            </button>
            <strong>Ảnh đại diện</strong>
            <small>
              {reading ? "Đang tải lên Cloudinary…" : "Không bắt buộc"}
            </small>
            <input
              ref={upload}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                void readAvatar(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {avatar && (
              <button
                type="button"
                className={styles.textButton}
                onClick={() => {
                  uploadRequestId.current++;
                  setReading(false);
                  setAvatar(null);
                }}
              >
                Xóa ảnh
              </button>
            )}
          </div>
          <div className={styles.infoFields}>
            <div className={styles.infoTop}>
              <label>
                Tên cửa hàng <b>*</b>
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                Mô tả ngắn <b>*</b>
                <input
                  required
                  maxLength={200}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            </div>
            <div className={styles.infoBottom}>
              <label>
                Khu vực / địa điểm <b>*</b>
                <select
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                >
                  {locations.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Số điện thoại liên hệ <b>*</b>
                <input
                  required
                  type="tel"
                  maxLength={20}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>
              <label>
                Đường dẫn quán
                <div className={styles.linkBox}>
                  <input
                    readOnly
                    value={restaurantPath}
                    aria-label="Đường dẫn quán"
                  />
                  <button
                    type="button"
                    aria-label="Sao chép đường dẫn quán"
                    onClick={() =>
                      void copy(`${window.location.origin}${restaurantPath}`)
                    }
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </label>
            </div>
            <footer>
              <button
                type="submit"
                className={styles.primary}
                disabled={reading}
              >
                Lưu thông tin
              </button>
            </footer>
          </div>
        </form>
      </section>
      <div className={styles.middle}>
        <section className={styles.card}>
          <h2>Giờ hoạt động</h2>
          <form onSubmit={saveSchedule}>
            <div className={styles.scheduleColumns}>
              <div>
                <div className={styles.radios}>
                  <label>
                    <input
                      type="radio"
                      name="schedule-mode"
                      checked={mode === "same"}
                      onChange={() => {
                        setDays(schedule);
                        setMode("same");
                      }}
                    />
                    Giống nhau mỗi ngày
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="schedule-mode"
                      checked={mode === "daily"}
                      onChange={() => {
                        setDays(schedule);
                        setMode("daily");
                      }}
                    />
                    Thiết lập theo từng ngày
                  </label>
                </div>
                {mode === "same" ? (
                  <>
                    <div className={styles.times}>
                      <label>
                        Giờ mở cửa
                        <select
                          required
                          value={opens}
                          onChange={(event) => setOpens(event.target.value)}
                        >{timeChoices.map((time) => <option key={time}>{time}</option>)}</select>
                      </label>
                      <label>
                        Giờ đóng cửa
                        <select
                          required
                          value={closes}
                          onChange={(event) => setCloses(event.target.value)}
                        >{timeChoices.map((time) => <option key={time}>{time}</option>)}</select>
                      </label>
                    </div>
                    <strong className={styles.dayTitle}>
                      Áp dụng cho các ngày
                    </strong>
                    <div className={styles.dayChips}>
                      {days.map((day, index) => (
                        <label key={day.label} data-active={day.enabled}>
                          <input
                            type="checkbox"
                            checked={day.enabled}
                            onChange={(event) =>
                              setDays((current) =>
                                current.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        enabled: event.target.checked,
                                      }
                                    : entry,
                                ),
                              )
                            }
                          />
                          {day.label}
                        </label>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className={styles.daily}>
                    {days.map((day, index) => (
                      <div key={day.label}>
                        <label>
                          <input
                            type="checkbox"
                            checked={day.enabled}
                            onChange={(event) =>
                              setDays((current) =>
                                current.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        enabled: event.target.checked,
                                      }
                                    : entry,
                                ),
                              )
                            }
                          />
                          {day.label}
                        </label>
                        <input
                          type="time"
                          disabled={!day.enabled}
                          aria-label={`Giờ mở ${day.label}`}
                          value={day.opens}
                          onChange={(event) =>
                            setDays((current) =>
                              current.map((entry, i) =>
                                i === index
                                  ? { ...entry, opens: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <span>–</span>
                        <input
                          type="time"
                          disabled={!day.enabled}
                          aria-label={`Giờ đóng ${day.label}`}
                          value={day.closes}
                          onChange={(event) =>
                            setDays((current) =>
                              current.map((entry, i) =>
                                i === index
                                  ? { ...entry, closes: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <aside className={styles.schedulePreview}>
                <strong>
                  Lịch hoạt động <small>(xem trước)</small>
                </strong>
                {previewDays.map((day) => (
                  <div key={day.label}>
                    <span>{day.label}</span>
                    <span>
                      {day.enabled ? `${day.opens} - ${day.closes}` : "Nghỉ"}
                    </span>
                  </div>
                ))}
              </aside>
            </div>
            <footer>
              <button className={styles.outline} type="submit">
                Lưu lịch
              </button>
            </footer>
          </form>
        </section>
        <div className={styles.rightStack}>
          <section className={styles.card}>
            <h2>Trạng thái hoạt động</h2>
            <div className={styles.statusCompactRow} data-open={open}>
              <div className={styles.statusCompactInfo}>
                <span className={styles.statusCompactIcon} aria-hidden="true">
                  <Store size={26} />
                </span>
                <div className={styles.statusCompactCopy}>
                  <strong>
                    <Store size={16} aria-hidden="true" />
                    {open ? "Đang mở" : "Tạm ngừng"}
                  </strong>
                  <p>{open ? "Đang nhận đơn" : "Chưa nhận đơn"}</p>
                </div>
              </div>
              <button
                type="button"
                className={open ? styles.outline : styles.statusActionBtn}
                onClick={toggleOperatingStatus}
              >
                {open ? "Tạm ngừng" : "Mở nhận đơn"}
              </button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.staffCardHeader}>
              <h2>Quản lý nhân viên</h2>
              <span className={styles.qrActivePill}>QR bật</span>
            </div>

            <div className={styles.staffQrRow}>
              <div className={styles.staffQrThumb} aria-hidden="true">
                <QrCode size={34} strokeWidth={1.9} />
              </div>
              <div className={styles.staffQrCopy}>
                <strong>QR tuyển nhân viên</strong>
                <p>{staffRequests.length} yêu cầu chờ duyệt</p>
              </div>
            </div>

            <div className={styles.staffActionsRow}>
              <button
                type="button"
                className={styles.staffPrimaryBtn}
                onClick={() => setShowStaffQrModal(true)}
              >
                Xem QR
              </button>
              <button
                type="button"
                className={styles.staffOutlineBtn}
                onClick={() => setShowStaffRequestsModal(true)}
              >
                Yêu cầu ({staffRequests.length})
              </button>
            </div>
          </section>
        </div>
      </div>
      <section className={styles.card}>
        <div className={styles.deliveryHeading}>
          <h2>Quyền giao hàng</h2>
          <p>
            Cho phép shipper xem đơn cần giao qua liên kết riêng khi backend
            được kết nối.
          </p>
        </div>
        <div className={styles.delivery}>
          <div className={styles.linkBox}>
            <input
              readOnly
              value={
                demoToken
                  ? `/delivery/demo/${demoToken}`
                  : "Chưa tạo liên kết giao hàng demo"
              }
              aria-label="Liên kết giao hàng demo"
            />
          </div>
          <button
            className={styles.outline}
            disabled={!demoToken}
            onClick={() =>
              void copy(`${window.location.origin}/delivery/demo/${demoToken}`)
            }
          >
            <Copy size={18} />
            Sao chép liên kết
          </button>
          <button className={styles.outline} onClick={() => setManage(true)}>
            <Settings size={18} />
            Quản lý liên kết
          </button>
          <span className={styles.warning}>
            <TriangleAlert size={19} />
            Tạo lại liên kết sẽ thay thế mã demo cũ.
          </span>
        </div>
        <small className={styles.updated}>
          {tokenUpdated
            ? `Cập nhật lần cuối: ${tokenUpdated}`
            : "Chưa có liên kết. Demo này chưa cấp quyền xem đơn giao hàng."}
        </small>
      </section>
      <p className={styles.demo}>
        Demo frontend · Chưa ghi DB. Trang quán vẫn dùng dữ liệu
        mẫu. Liên kết giao hàng demo không hoạt động và không cấp quyền truy
        cập. Thông tin đăng ký cơ bản giữ trong phiên; các cài đặt mới ở đây mất
        khi tải lại trang.
      </p>
      {manage && (
        <dialog
          ref={dialog}
          className={styles.dialog}
          onClose={() => setManage(false)}
          aria-labelledby="delivery-dialog-title"
        >
          <header>
            <h2 id="delivery-dialog-title">Quản lý liên kết giao hàng</h2>
            <button aria-label="Đóng" onClick={() => setManage(false)}>
              <X />
            </button>
          </header>
          <p>
            Chỉ mô phỏng giao diện. Chưa gọi RPC reset_delivery_token và chưa
            tạo quyền cho shipper.
          </p>
          <p>
            Tạo lại sẽ thay thế mã demo đang hiển thị, không thu hồi token nào
            trên DB.
          </p>
          <footer>
            <button className={styles.outline} onClick={() => setManage(false)}>
              Hủy
            </button>
            <button
              className={styles.primary}
              onClick={() => {
                setDemoToken(crypto.randomUUID());
                setTokenUpdated(
                  new Date().toLocaleString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  }),
                );
                setManage(false);
                message("Đã tạo mã demo mới. Liên kết chưa hoạt động.");
              }}
            >
              {demoToken ? "Tạo lại liên kết demo" : "Tạo liên kết demo"}
            </button>
          </footer>
        </dialog>
      )}
      {showStaffQrModal && (
        <div
          className={styles.staffQrBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-qr-modal-title"
          onClick={() => setShowStaffQrModal(false)}
        >
          <div
            className={styles.staffQrModal}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.staffQrCloseBtn}
              aria-label="Đóng"
              onClick={() => setShowStaffQrModal(false)}
            >
              <X size={21} strokeWidth={2} />
            </button>

            <div className={styles.staffQrModalHeader}>
              <span className={styles.staffQrHeaderIcon} aria-hidden="true">
                <QrCode size={24} strokeWidth={2} />
              </span>
              <div>
                <h2 id="staff-qr-modal-title">Mã QR tuyển nhân viên</h2>
                <p>
                  Sinh viên quét mã để gửi yêu cầu xin làm nhân viên tại cửa
                  hàng của bạn.
                </p>
              </div>
            </div>

            <div className={styles.staffQrInnerCard}>
              <h3>{name.trim() || shop.name || demoSellerRestaurant.name}</h3>

              <span className={styles.staffQrLocation}>
                <MapPin size={15} strokeWidth={2} aria-hidden="true" />
                {location || shop.location || "KTX A"}
              </span>

              <span className={styles.staffQrStatusPill}>
                <span className={styles.staffQrStatusDot} aria-hidden="true" />
                QR đang hoạt động
              </span>

              <div className={styles.staffQrCodeFrame} aria-hidden="true">
                <svg viewBox="0 0 120 120" fill="#000000">
                  {/* Top-left finder */}
                  <path d="M6 6h34v34H6V6zm6 6v22h22V12H12zm5 5h12v12H17V17z" />
                  {/* Top-right finder */}
                  <path d="M80 6h34v34H80V6zm6 6v22h22V12H86zm5 5h12v12H91V17z" />
                  {/* Bottom-left finder */}
                  <path d="M6 80h34v34H6V80zm6 6v22h22V86H12zm5 5h12v12H17V91z" />
                  {/* QR Modules */}
                  <rect x="46" y="6" width="6" height="12" />
                  <rect x="58" y="6" width="6" height="6" />
                  <rect x="64" y="12" width="10" height="6" />
                  <rect x="46" y="24" width="12" height="6" />
                  <rect x="64" y="24" width="6" height="10" />
                  <rect x="52" y="34" width="6" height="6" />
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
              </div>

              <p className={styles.staffQrCaption}>
                Mã QR này dùng để sinh viên gửi yêu cầu gia nhập. Yêu cầu sẽ
                cần bạn phê duyệt trước khi cấp quyền nhân viên.
              </p>
            </div>

            <div className={styles.staffQrModalFooter}>
              <button
                type="button"
                className={styles.staffQrDismissBtn}
                onClick={() => setShowStaffQrModal(false)}
              >
                Đóng
              </button>

              <button
                type="button"
                className={styles.staffQrDownloadBtn}
                onClick={() => {
                  setShowStaffQrModal(false);
                  message("Đã tải mã QR tuyển nhân viên về thiết bị.");
                }}
              >
                <Download size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>Tải mã QR</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {showStaffRequestsModal && (
        <div
          className={styles.staffQrBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-requests-modal-title"
          onClick={() => setShowStaffRequestsModal(false)}
        >
          <div
            className={styles.staffReqModal}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.staffQrCloseBtn}
              aria-label="Đóng"
              onClick={() => setShowStaffRequestsModal(false)}
            >
              <X size={21} strokeWidth={2} />
            </button>

            <div className={styles.staffReqHeader}>
              <h2 id="staff-requests-modal-title">Yêu cầu gia nhập cửa hàng</h2>
              <p>
                Xem xét các sinh viên muốn làm nhân viên tại cửa hàng của bạn.
              </p>
            </div>

            <div className={styles.staffReqSummaryBar}>
              <span className={styles.staffReqSummaryIcon} aria-hidden="true">
                <Users size={21} strokeWidth={2.2} />
              </span>
              <strong>Đang chờ duyệt</strong>
              <span className={styles.staffReqCountPill}>
                {staffRequests.length} yêu cầu
              </span>
            </div>

            {staffRequests.length > 0 ? (
              <div className={styles.staffReqList}>
                {staffRequests.map((req) => (
                  <article key={req.id} className={styles.staffReqCard}>
                    <div className={styles.staffReqTopRow}>
                      <div className={styles.staffReqUserLeft}>
                        <span
                          className={styles.staffReqAvatar}
                          aria-hidden="true"
                        >
                          {req.initial}
                        </span>

                        <div className={styles.staffReqUserInfo}>
                          <h3>{req.name}</h3>

                          <span className={styles.staffReqMetaItem}>
                            <Phone
                              size={13.5}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            {req.phone}
                          </span>

                          <span className={styles.staffReqMetaItem}>
                            <Clock3
                              size={13.5}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            {req.requestedAt}
                          </span>
                        </div>
                      </div>

                      <span className={styles.staffReqPendingBadge}>
                        Chờ duyệt
                      </span>
                    </div>

                    <div className={styles.staffReqActionRow}>
                      <button
                        type="button"
                        className={styles.staffReqRejectBtn}
                        onClick={() => {
                          setStaffRequests((prev) =>
                            prev.filter((item) => item.id !== req.id),
                          );
                          message(
                            `Đã từ chối yêu cầu gia nhập của ${req.name}.`,
                          );
                        }}
                      >
                        Từ chối
                      </button>

                      <button
                        type="button"
                        className={styles.staffReqAcceptBtn}
                        onClick={() => {
                          setStaffRequests((prev) =>
                            prev.filter((item) => item.id !== req.id),
                          );
                          message(
                            `Đã chấp nhận ${req.name} làm nhân viên (Staff) của cửa hàng.`,
                          );
                        }}
                      >
                        Chấp nhận
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.staffReqEmpty}>
                Hiện không còn yêu cầu gia nhập nào đang chờ duyệt.
              </div>
            )}

            <div className={styles.staffReqNoticeBox} role="note">
              <CircleAlert
                size={19}
                strokeWidth={2.1}
                className={styles.staffReqNoticeIcon}
                aria-hidden="true"
              />
              <span>
                Khi chấp nhận, sinh viên sẽ được cấp quyền Staff tại cửa hàng
                của bạn. Bạn có thể quản lý quyền nhân viên sau này.
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
