"use client";

import StaffRecruitment from "./StaffRecruitment";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Camera,
  Copy,
  ExternalLink,
  Settings,
  Store,
  TriangleAlert,
  X,
} from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import { useSellerAccess } from "./SellerAccessProvider";
import { useAuthStore } from "@/store/useAuthStore";
import { updateSellerRestaurant } from "@/lib/seller/management-client";
import { readShopSchedule, shopSchedulePayload } from "@/lib/seller/schedule-client";
import type { SellerAccess } from "@/types/seller-access.types";
import type { SellerRestaurantPatch } from "@/types/seller.types";
import { CloudinaryService } from "@/services/cloudinary.service";
import shell from "@/styles/seller-menu.module.css";
import styles from "@/styles/seller-shop.module.css";

export default function SellerShopView() {
  const { data, error, retry } = useSellerAccess();
  return (
    <div className={`${shell.page} ${styles.page}`}>
      <StudentHeader variant="seller" />
      <div className={styles.workspace}>
        <SellerSidebar active="shop" name={data?.restaurant?.name ?? ""} />
        {data?.restaurant ? (
          <ShopForm key={`${data.user.id}:${data.restaurant.id}`} initial={data.restaurant} actorId={data.user.id} />
        ) : (
          <main className={styles.card}>{error || "Đang tải thông tin cửa hàng…"}{error && <button onClick={retry}>Thử lại</button>}</main>
        )}
      </div>
    </div>
  );
}

export function ShopForm({ initial, actorId }: { initial: NonNullable<SellerAccess["restaurant"]>; actorId: string }) {
  const parsedSchedule = readShopSchedule(initial.operating_hours);
  const baseline = useRef({ name: initial.name, description: initial.description ?? "", location: initial.location ?? "" });
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [avatar, setAvatar] = useState(initial.avatar_url);
  const [days, setDays] = useState(parsedSchedule.days);
  const [mode, setMode] = useState(parsedSchedule.mode);
  const [opens, setOpens] = useState(parsedSchedule.days.find(day => day.enabled)?.opens ?? "10:00");
  const [closes, setCloses] = useState(parsedSchedule.days.find(day => day.enabled)?.closes ?? "14:00");
  const open = initial.operating_status === "open";
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [manage, setManage] = useState(false);
  const [demoToken, setDemoToken] = useState("");
  const [tokenUpdated, setTokenUpdated] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const uploadRequestId = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (manage) dialog.current?.showModal();
  }, [manage]);
  const restaurantPath = `/restaurants/${encodeURIComponent(initial.slug)}`;
  const schedule = days.map((day) =>
    mode === "same" ? { ...day, opens, closes } : day,
  );
  const weekdays = schedule.slice(0, 5);
  const sameWeekdays = weekdays.every((day) => day.enabled === weekdays[0].enabled &&
    (!day.enabled || (day.opens === weekdays[0].opens && day.closes === weekdays[0].closes)));
  const previewDays = sameWeekdays ? [{ ...weekdays[0], label: "T2 - T6" }, ...schedule.slice(5)] : schedule;
  const timeChoices = [...new Set([...Array.from({ length: 96 }, (_, index) =>
    `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`), opens, closes])].sort();

  function message(value: string) {
    setError("");
    setNotice(value);
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      message("Đã sao chép liên kết.");
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
      if (mounted.current && uploadRequestId.current === requestId) {
        setAvatar(uploaded.secureUrl);
      }
    } catch (err) {
      if (mounted.current && uploadRequestId.current === requestId) {
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải ảnh đại diện lên Cloudinary.",
        );
      }
    } finally {
      if (mounted.current && uploadRequestId.current === requestId) {
        setReading(false);
      }
    }
  }
  async function persist(patch: SellerRestaurantPatch) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true); setError(""); setNotice("");
    try {
      await updateSellerRestaurant(actorId, initial.id, patch);
      if (!mounted.current || useAuthStore.getState().user?.id !== actorId) return;
      // Chỉ đánh dấu những giá trị vừa gửi đã lưu; không ghi lại field từ snapshot cũ.
      for (const field of ["name", "description", "location"] as const) {
        if (patch[field] !== undefined) baseline.current[field] = patch[field].trim();
      }
      if (patch.name !== undefined) setName(patch.name.trim());
      if (patch.description !== undefined) setDescription(patch.description.trim());
      if (patch.location !== undefined) setLocation(patch.location.trim());
      message(patch.schedule ? "Đã lưu lịch hoạt động vào cửa hàng." : "Đã lưu thông tin cửa hàng. Ảnh xem trước không được lưu cùng thông tin.");
    } catch (err) {
      if (mounted.current && useAuthStore.getState().user?.id === actorId)
        setError(err instanceof Error ? err.message : "Không thể lưu cửa hàng.");
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  async function saveInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const patch: SellerRestaurantPatch = {};
    for (const [field, value, max] of [["name", name, 100], ["description", description, 300], ["location", location, 200]] as const) {
      if (value !== baseline.current[field]) {
        if (!value.trim() || value.length > max) { setError(`Kiểm tra ${field}: không được trống, tối đa ${max} ký tự.`); return; }
        patch[field] = value;
      }
    }
    if (!Object.keys(patch).length) { message("Không có thay đổi tên, mô tả hoặc địa điểm để lưu. Ảnh chỉ xem trước."); return; }
    await persist(patch);
  }
  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await persist({ schedule: shopSchedulePayload(mode, days, opens, closes) }); }
    catch (err) { setError(err instanceof Error ? err.message : "Lịch hoạt động không hợp lệ."); }
  }

  return (
    <main className={styles.main}>
      <header className={styles.heading}>
        <div>
          <h1>Cửa hàng</h1>
          <p>Quản lý thông tin và trạng thái hoạt động của cửa hàng bạn.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.badge} data-open={open}>
            ● {open ? "Đang nhận đơn" : "Tạm ngừng nhận đơn"}
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
          <fieldset disabled={saving} style={{ display: "contents" }}>
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
              {reading ? "Đang tải lên Cloudinary…" : avatar !== initial.avatar_url ? "Ảnh chỉ xem trước; chưa lưu vào quán" : "Ảnh từ DB; thay ảnh hiện chỉ xem trước"}
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
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                Mô tả ngắn <b>*</b>
                <input
                  required
                  maxLength={300}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            </div>
            <div className={styles.infoBottom}>
              <label>
                Khu vực / địa điểm <b>*</b>
                <input required maxLength={200} value={location} onChange={(event) => setLocation(event.target.value)} />
              </label>
              <label>
                Số điện thoại liên hệ
                <input disabled value="Chưa hỗ trợ lưu ở màn này" readOnly />
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
                disabled={reading || saving}
              >
                Lưu thông tin
              </button>
            </footer>
          </div>
          </fieldset>
        </form>
      </section>
      <div className={styles.middle}>
        <section className={styles.card}>
          <h2>Giờ hoạt động</h2>
          <form onSubmit={saveSchedule}>
            <fieldset disabled={saving} style={{ display: "contents" }}>
            {!parsedSchedule.recognized && <p role="status">Lịch cũ chưa theo quy ước hiện tại. Chỉ thay thế lịch khi bạn bấm Lưu lịch.</p>}
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
                  <label><input type="radio" name="schedule-mode" checked={mode === "later"} onChange={() => setMode("later")} />Thiết lập sau</label>
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
                ) : mode === "daily" ? (
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
                ) : <p>Lưu lựa chọn này sẽ xóa lịch hiện tại (SQL NULL).</p>}
              </div>
              <aside className={styles.schedulePreview}>
                <strong>
                  Lịch hoạt động <small>(xem trước)</small>
                </strong>
                {mode === "later" ? <p>Chưa thiết lập lịch</p> : previewDays.map((day) => (
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
              <button className={styles.outline} type="submit" disabled={saving}>
                Lưu lịch
              </button>
            </footer>
            </fieldset>
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
                disabled
                title="Chưa nối thay đổi trạng thái ở màn này"
              >
                {open ? "Tạm ngừng" : "Mở nhận đơn"}
              </button>
            </div>
          </section>

          <StaffRecruitment />
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
        Thông tin và lịch được lưu qua API. Ảnh tải lên Cloudinary chỉ xem trước,
        chưa cập nhật avatar_url. Đổi trạng thái và liên kết giao hàng ở màn này chưa nối backend.

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
    </main>
  );
}
