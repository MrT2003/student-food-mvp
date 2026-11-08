"use client";

import StaffRecruitment from "./StaffRecruitment";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  ChevronRight,
  CirclePause,
  Clock3,
  Copy,
  ExternalLink,
  MapPin,
  Pencil,
  Settings,
  Store,
  TriangleAlert,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import { useSellerAccess } from "./SellerAccessProvider";
import { useAuthStore } from "@/store/useAuthStore";
import { updateSellerRestaurant } from "@/lib/seller/management-client";
import {
  readShopSchedule,
  shopDays,
  shopSchedulePayload,
  type EditableShopDay,
} from "@/lib/seller/schedule-client";
import type { SellerPreview } from "@/store/useSellerPreviewStore";
import type { SellerShopPreview, ShopDay } from "@/store/useSellerShopStore";
import type { SellerPaymentPreview } from "@/store/useSellerPaymentStore";
import type { SellerAccess } from "@/types/seller-access.types";
import type { SellerRestaurantPatch } from "@/types/seller.types";
import { CloudinaryService } from "@/services/cloudinary.service";
import shell from "@/styles/seller-menu.module.css";
import styles from "@/styles/seller-shop.module.css";

export const DEFAULT_SELLER_MOBILE_SHOP_IMAGE = "/seller-shop-com-co-ba.png";

const DEMO_SHOP_NAME = "Cơm Cô Ba";
const DEMO_SHOP_SLUG = "com-co-ba";
const DEMO_SHOP_DESCRIPTION =
  "Cơm nhà làm nóng hổi mỗi trưa, đóng hộp sạch sẽ, nhận đơn theo khung giờ.";
const DEMO_SHOP_LOCATION = "KTX A";

export type SellerMobileSetupItem = {
  id: "store-info" | "operating-hours" | "payments";
  title: string;
  icon: "store" | "clock" | "wallet";
  href?: string;
};

export const sellerMobileShopSetupItems: readonly SellerMobileSetupItem[] = [
  {
    id: "store-info",
    title: "Thông tin cửa hàng",
    icon: "store",
  },
  {
    id: "operating-hours",
    title: "Giờ hoạt động",
    icon: "clock",
  },
  {
    id: "payments",
    title: "Thanh toán",
    icon: "wallet",
    href: "/seller/payments",
  },
] as const;

export function createInitialSellerShopPreview(
  draft: SellerPreview | null = null,
): SellerShopPreview {
  const hours = draft?.hours.match(/(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
  return {
    name: draft?.name || DEMO_SHOP_NAME,
    description: draft?.description || DEMO_SHOP_DESCRIPTION,
    location: draft?.location || DEMO_SHOP_LOCATION,
    avatar_url: draft?.avatar_url ?? null,
    contactPhonePreview: "0901 234 567",
    openPreview: false,
    startPausedPreview: true,
    scheduleModePreview: "same",
    daysPreview: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => ({
      label,
      enabled: label !== "CN",
      opens: hours?.[1] ?? "10:00",
      closes: hours?.[2] ?? "14:00",
    })),
  };
}

export function getSellerMobileShopAvatar(avatarUrl?: string | null): string {
  const trimmed = avatarUrl?.trim();
  return trimmed ? trimmed : DEFAULT_SELLER_MOBILE_SHOP_IMAGE;
}

export function formatSellerMobileScheduleSummary(days: readonly ShopDay[]): {
  hoursLine: string;
  closedLine: string | null;
} {
  const enabledDays = days.filter((day) => day.enabled);
  const disabledDays = days.filter((day) => !day.enabled);

  if (enabledDays.length === 0) {
    return {
      hoursLine: "Chưa thiết lập giờ mở cửa",
      closedLine: "Tất cả các ngày nghỉ",
    };
  }

  const first = enabledDays[0];
  const allSameHours = enabledDays.every(
    (day) => day.opens === first.opens && day.closes === first.closes,
  );

  const enabledLabels = enabledDays.map((day) => day.label);
  const isContiguousFromMonday =
    enabledDays.every((day, idx) => day.label === days[idx]?.label) &&
    enabledDays.length >= 2;

  const dayRangeText = isContiguousFromMonday
    ? `${enabledLabels[0]} – ${enabledLabels[enabledLabels.length - 1]}`
    : enabledLabels.join(", ");

  const hoursLine = allSameHours
    ? `${dayRangeText} · ${first.opens} – ${first.closes}`
    : `${dayRangeText} · Theo từng ngày`;

  let closedLine: string | null = null;
  if (disabledDays.length === 1 && disabledDays[0].label === "CN") {
    closedLine = "Chủ nhật nghỉ";
  } else if (disabledDays.length > 0) {
    const labels = disabledDays.map((day) =>
      day.label === "CN" ? "Chủ nhật" : day.label,
    );
    closedLine = `${labels.join(", ")} nghỉ`;
  }

  return { hoursLine, closedLine };
}

export function formatSellerMobilePaymentSummary(
  payment?: SellerPaymentPreview | null,
  draft?: SellerPreview | null,
): string {
  const cashEnabled = payment
    ? payment.cashEnabledPreview
    : (draft?.cash ?? true);
  const bankEnabled = payment
    ? payment.bankEnabledPreview
    : (draft?.bank ?? true);
  const bankConfigured = payment
    ? Boolean(
        payment.bank_name &&
          payment.account_no?.trim() &&
          payment.account_name?.trim(),
      )
    : true;

  if (cashEnabled && bankEnabled && bankConfigured) {
    return "Tiền mặt · Đã thiết lập chuyển khoản";
  }
  if (cashEnabled && (!bankEnabled || !bankConfigured)) {
    return "Tiền mặt · Chưa thiết lập chuyển khoản";
  }
  if (!cashEnabled && bankEnabled && bankConfigured) {
    return "Đã thiết lập chuyển khoản";
  }
  return "Chưa thiết lập thanh toán";
}

type ShopFormInput = NonNullable<SellerAccess["restaurant"]> | SellerShopPreview;

function isBackendRestaurant(
  initial: ShopFormInput,
): initial is NonNullable<SellerAccess["restaurant"]> {
  return "id" in initial && "slug" in initial;
}

function toEditableSchedule(initial: ShopFormInput): {
  days: EditableShopDay[];
  mode: "same" | "daily" | "later";
  recognized: boolean;
} {
  if (isBackendRestaurant(initial)) {
    return readShopSchedule(initial.operating_hours);
  }
  const days: EditableShopDay[] = shopDays.map((id, index) => {
    const preview = initial.daysPreview[index];
    return {
      id,
      label: preview?.label ?? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][index],
      enabled: preview?.enabled ?? id !== "sun",
      opens: preview?.opens ?? "10:00",
      closes: preview?.closes ?? "14:00",
    };
  });
  return {
    days,
    mode: initial.scheduleModePreview,
    recognized: true,
  };
}

export default function SellerShopView() {
  const { data, error, retry } = useSellerAccess();

  if (data?.restaurant) {
    const isStaff = data.user.role === "staff";
    return (
      <div className={`${shell.page} ${styles.page}`}>
        <StudentHeader variant="seller" />
        <div className={styles.workspace}>
          <SellerSidebar
            active="shop"
            name={data.restaurant.name}
            menuLabel="Thực đơn"
          />
          <ShopForm
            key={`${data.user.id}:${data.restaurant.id}`}
            initial={data.restaurant}
            actorId={data.user.id}
            isStaff={isStaff}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${shell.page} ${styles.page}`}>
        <StudentHeader variant="seller" />
        <div className={styles.workspace}>
          <SellerSidebar active="shop" name="" menuLabel="Thực đơn" />
          <main className={styles.card}>
            {error}
            <button onClick={retry}>Thử lại</button>
          </main>
        </div>
      </div>
    );
  }

  const effectiveShop = createInitialSellerShopPreview(null);

  return (
    <div className={`${shell.page} ${styles.page}`}>
      <StudentHeader variant="seller" />
      <div className={styles.workspace}>
        <SellerSidebar
          active="shop"
          name={effectiveShop.name}
          menuLabel="Thực đơn"
        />
        <ShopForm key="preview" initial={effectiveShop} />
      </div>
    </div>
  );
}

export function ShopForm({
  initial,
  actorId,
  isStaff = false,
}: {
  initial: ShopFormInput;
  actorId?: string;
  isStaff?: boolean;
}) {
  const hasBackend = isBackendRestaurant(initial) && Boolean(actorId);
  const parsedSchedule = toEditableSchedule(initial);

  const baseline = useRef({
    name: initial.name,
    description: initial.description ?? "",
    location: initial.location ?? "",
  });
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [avatar, setAvatar] = useState(initial.avatar_url);
  const [days, setDays] = useState<EditableShopDay[]>(parsedSchedule.days);
  const [mode, setMode] = useState<"same" | "daily" | "later">(
    parsedSchedule.mode,
  );
  const [opens, setOpens] = useState(
    parsedSchedule.days.find((day) => day.enabled)?.opens ?? "10:00",
  );
  const [closes, setCloses] = useState(
    parsedSchedule.days.find((day) => day.enabled)?.closes ?? "14:00",
  );
  const [openState, setOpenState] = useState(
    isBackendRestaurant(initial)
      ? initial.operating_status === "open"
      : initial.openPreview,
  );
  const [mobileOpen, setMobileOpen] = useState(
    isBackendRestaurant(initial) ? initial.operating_status === "open" : true,
  );
  const [mobileSheet, setMobileSheet] = useState<"info" | "schedule" | null>(
    null,
  );
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

  const open = isBackendRestaurant(initial)
    ? initial.operating_status === "open"
    : openState;
  const slug = isBackendRestaurant(initial) ? initial.slug : DEMO_SHOP_SLUG;
  const restaurantPath = `/restaurants/${encodeURIComponent(slug)}`;
  const schedule = days.map((day) =>
    mode === "same" ? { ...day, opens, closes } : day,
  );
  const weekdays = schedule.slice(0, 5);
  const sameWeekdays = weekdays.every(
    (day) =>
      day.enabled === weekdays[0].enabled &&
      (!day.enabled ||
        (day.opens === weekdays[0].opens && day.closes === weekdays[0].closes)),
  );
  const previewDays = sameWeekdays
    ? [{ ...weekdays[0], label: "T2 - T6" }, ...schedule.slice(5)]
    : schedule;
  const timeChoices = [
    ...new Set([
      ...Array.from(
        { length: 96 },
        (_, index) =>
          `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`,
      ),
      opens,
      closes,
    ]),
  ].sort();

  const mobileStoreName = name.trim() || initial.name || DEMO_SHOP_NAME;
  const mobileStoreLocation =
    location || initial.location || DEMO_SHOP_LOCATION;
  const mobileAvatarSrc = getSellerMobileShopAvatar(
    avatar ?? initial.avatar_url,
  );
  const mobileScheduleDays: ShopDay[] =
    mode === "later" &&
    isBackendRestaurant(initial) &&
    initial.operating_hours === null
      ? createInitialSellerShopPreview(null).daysPreview
      : schedule;
  const mobileScheduleSummary =
    formatSellerMobileScheduleSummary(mobileScheduleDays);
  const mobilePaymentSummary = formatSellerMobilePaymentSummary(null, null);
  const mobileDeliveryToken = demoToken || "com-co-ba-ktx-a";

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
    if (!hasBackend || !isBackendRestaurant(initial) || !actorId) {
      for (const field of ["name", "description", "location"] as const) {
        if (patch[field] !== undefined)
          baseline.current[field] = patch[field].trim();
      }
      setMobileSheet(null);
      message(
        patch.schedule
          ? "Đã lưu lịch hoạt động trong bản demo."
          : "Đã lưu thông tin trong bản demo, chưa ghi database.",
      );
      return;
    }
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await updateSellerRestaurant(actorId, initial.id, patch);
      if (!mounted.current || useAuthStore.getState().user?.id !== actorId)
        return;
      // Chỉ đánh dấu những giá trị vừa gửi đã lưu; không ghi lại field từ snapshot cũ.
      for (const field of ["name", "description", "location"] as const) {
        if (patch[field] !== undefined)
          baseline.current[field] = patch[field].trim();
      }
      if (patch.name !== undefined) setName(patch.name.trim());
      if (patch.description !== undefined)
        setDescription(patch.description.trim());
      if (patch.location !== undefined) setLocation(patch.location.trim());
      setMobileSheet(null);
      message(
        patch.schedule
          ? "Đã lưu lịch hoạt động vào cửa hàng."
          : "Đã lưu thông tin cửa hàng. Ảnh xem trước không được lưu cùng thông tin.",
      );
    } catch (err) {
      if (mounted.current && useAuthStore.getState().user?.id === actorId)
        setError(
          err instanceof Error ? err.message : "Không thể lưu cửa hàng.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  async function saveInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const patch: SellerRestaurantPatch = {};
    for (const [field, value, max] of [
      ["name", name, 100],
      ["description", description, 300],
      ["location", location, 200],
    ] as const) {
      if (value !== baseline.current[field]) {
        if (!value.trim() || value.length > max) {
          setError(
            `Kiểm tra ${field}: không được trống, tối đa ${max} ký tự.`,
          );
          return;
        }
        patch[field] = value;
      }
    }
    if (!Object.keys(patch).length) {
      message(
        "Không có thay đổi tên, mô tả hoặc địa điểm để lưu. Ảnh chỉ xem trước.",
      );
      return;
    }
    await persist(patch);
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await persist({
        schedule: shopSchedulePayload(mode, days, opens, closes),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Lịch hoạt động không hợp lệ.",
      );
    }
  }

  function toggleOperatingStatus() {
    const nextOpen = !openState;
    setOpenState(nextOpen);
    setMobileOpen(nextOpen);
    message(
      nextOpen
        ? "Đã mở nhận đơn trong bản demo."
        : "Đã tạm ngừng nhận đơn trong bản demo.",
    );
  }

  function toggleMobileOperatingStatus() {
    const nextOpen = !mobileOpen;
    setMobileOpen(nextOpen);
    setOpenState(nextOpen);
    message(
      nextOpen
        ? "Đã mở nhận đơn trong bản demo."
        : "Đã tạm ngừng nhận đơn trong bản demo.",
    );
  }

  return (
    <main className={styles.main}>
      {/* Phiên bản Desktop giữ nguyên 100% */}
      <div className={styles.desktopView}>
        <header className={styles.heading}>
          <div>
            <h1>Cửa hàng</h1>
            <p>
              {isStaff
                ? "Xem thông tin và trạng thái hoạt động của cửa hàng."
                : "Quản lý thông tin và trạng thái hoạt động của cửa hàng bạn."}
            </p>
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
        {(error || notice || isStaff) && (
          <p
            className={error ? styles.error : styles.notice}
            role={error ? "alert" : "status"}
          >
            {error ||
              notice ||
              "Bạn đang xem thông tin cửa hàng với quyền Nhân viên (Chỉ đọc)."}
          </p>
        )}
        <section className={styles.card}>
          <h2>Thông tin cửa hàng</h2>
          <form onSubmit={saveInfo} className={styles.info}>
            <fieldset
              disabled={saving || isStaff}
              style={{ display: "contents" }}
            >
              <div className={styles.avatarField}>
                <button
                  type="button"
                  className={styles.avatar}
                  aria-label="Thay ảnh đại diện cửa hàng"
                  onClick={() => !isStaff && upload.current?.click()}
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
                    <Image
                      src="/seller-store-placeholder.svg"
                      alt="Ảnh minh họa cửa hàng"
                      width={150}
                      height={150}
                    />
                  )}
                  {!isStaff && (
                    <span>
                      <Camera size={21} />
                    </span>
                  )}
                </button>
                <strong>Ảnh đại diện</strong>
                <small>
                  {isStaff
                    ? "Ảnh đại diện cửa hàng"
                    : reading
                      ? "Đang tải lên Cloudinary…"
                      : avatar !== initial.avatar_url
                        ? "Ảnh chỉ xem trước; chưa lưu vào quán"
                        : "Ảnh từ DB; thay ảnh hiện chỉ xem trước"}
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
                {avatar && !isStaff && (
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
                    <input
                      required
                      maxLength={200}
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                    />
                  </label>
                  <label>
                    Số điện thoại liên hệ
                    <input
                      disabled
                      value="Chưa hỗ trợ lưu ở màn này"
                      readOnly
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
                {!isStaff && (
                  <footer>
                    <button
                      type="submit"
                      className={styles.primary}
                      disabled={reading || saving}
                    >
                      Lưu thông tin
                    </button>
                  </footer>
                )}
              </div>
            </fieldset>
          </form>
        </section>
        <div className={styles.middle}>
          <section className={styles.card}>
            <h2>Giờ hoạt động</h2>
            <form onSubmit={saveSchedule}>
              <fieldset
                disabled={saving || isStaff}
                style={{ display: "contents" }}
              >
                {!parsedSchedule.recognized && (
                  <p role="status">
                    Lịch cũ chưa theo quy ước hiện tại. Chỉ thay thế lịch khi bạn
                    bấm Lưu lịch.
                  </p>
                )}
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
                      <label>
                        <input
                          type="radio"
                          name="schedule-mode"
                          checked={mode === "later"}
                          onChange={() => setMode("later")}
                        />
                        Thiết lập sau
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
                            >
                              {timeChoices.map((time) => (
                                <option key={time}>{time}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Giờ đóng cửa
                            <select
                              required
                              value={closes}
                              onChange={(event) => setCloses(event.target.value)}
                            >
                              {timeChoices.map((time) => (
                                <option key={time}>{time}</option>
                              ))}
                            </select>
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
                    ) : (
                      <p>Lưu lựa chọn này sẽ xóa lịch hiện tại (SQL NULL).</p>
                    )}
                  </div>
                  <aside className={styles.schedulePreview}>
                    <strong>
                      Lịch hoạt động <small>(xem trước)</small>
                    </strong>
                    {mode === "later" ? (
                      <p>Chưa thiết lập lịch</p>
                    ) : (
                      previewDays.map((day) => (
                        <div key={day.label}>
                          <span>{day.label}</span>
                          <span>
                            {day.enabled
                              ? `${day.opens} - ${day.closes}`
                              : "Nghỉ"}
                          </span>
                        </div>
                      ))
                    )}
                  </aside>
                </div>
                {!isStaff && (
                  <footer>
                    <button
                      className={styles.outline}
                      type="submit"
                      disabled={saving}
                    >
                      Lưu lịch
                    </button>
                  </footer>
                )}
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
                {!isStaff && (
                  <button
                    type="button"
                    className={open ? styles.outline : styles.statusActionBtn}
                    disabled={hasBackend}
                    onClick={hasBackend ? undefined : toggleOperatingStatus}
                    title={
                      hasBackend
                        ? "Chưa nối thay đổi trạng thái ở màn này"
                        : undefined
                    }
                  >
                    {open ? "Tạm ngừng" : "Mở nhận đơn"}
                  </button>
                )}
              </div>
            </section>

            {!isStaff && <StaffRecruitment />}
          </div>
        </div>
        {!isStaff && (
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
                  void copy(
                    `${window.location.origin}/delivery/demo/${demoToken}`,
                  )
                }
              >
                <Copy size={18} />
                Sao chép liên kết
              </button>
              <button
                className={styles.outline}
                onClick={() => setManage(true)}
              >
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
        )}
        <p className={styles.demo}>
          Thông tin và lịch được lưu qua API. Ảnh tải lên Cloudinary chỉ xem
          trước, chưa cập nhật avatar_url. Đổi trạng thái và liên kết giao hàng
          ở màn này chưa nối backend.
        </p>
      </div>

      {/* Phiên bản Mobile trùng khớp 100% với ảnh mẫu */}
      <div className={styles.mobileView} data-testid="seller-shop-mobile">
        <header className={styles.mobileHeading}>
          <h1>Cửa hàng</h1>
          <p>Quản lý thông tin và hoạt động của quán.</p>
        </header>

        {(error || notice) && (
          <div
            className={error ? styles.mobileError : styles.mobileNotice}
            role={error ? "alert" : "status"}
          >
            <span>{error || notice}</span>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => {
                setError("");
                setNotice("");
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Card 1: Thông tin tóm tắt quán */}
        <section
          className={styles.mobileProfileCard}
          aria-label="Thông tin tóm tắt cửa hàng"
        >
          <div className={styles.mobileProfileTop}>
            <div className={styles.mobileProfileThumb}>
              <Image
                src={mobileAvatarSrc}
                alt="Ảnh đại diện cửa hàng"
                width={76}
                height={76}
                unoptimized
                className={styles.mobileProfileImage}
              />
            </div>
            <div className={styles.mobileProfileInfo}>
              <h2>{mobileStoreName}</h2>
              <span className={styles.mobileProfileLocation}>
                <MapPin size={15} strokeWidth={2} aria-hidden="true" />
                {mobileStoreLocation}
              </span>
            </div>
            {!isStaff && (
              <button
                type="button"
                className={styles.mobileEditIconBtn}
                aria-label="Chỉnh sửa thông tin cửa hàng"
                onClick={() => setMobileSheet("info")}
              >
                <Pencil size={17} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className={styles.mobileProfileActions}>
            <Link
              href={restaurantPath}
              className={styles.mobileProfileActionBtn}
            >
              <ExternalLink size={16} strokeWidth={2.1} aria-hidden="true" />
              <span>Xem trang quán</span>
              <ArrowUpRight size={14} strokeWidth={2.3} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className={styles.mobileProfileActionBtn}
              onClick={() =>
                void copy(`${window.location.origin}${restaurantPath}`)
              }
            >
              <Copy size={16} strokeWidth={2.1} aria-hidden="true" />
              <span>Sao chép link</span>
            </button>
          </div>
        </section>

        {/* Card 2: Nhận đơn */}
        <section
          className={styles.mobileReceiveCard}
          aria-labelledby="mobile-receive-orders-heading"
        >
          <div className={styles.mobileReceiveHeader}>
            <h2 id="mobile-receive-orders-heading">Nhận đơn</h2>
            <span
              className={styles.mobileReceiveBadge}
              data-open={mobileOpen}
            >
              <span className={styles.mobileReceiveDot} aria-hidden="true" />
              {mobileOpen ? "Đang nhận đơn" : "Tạm ngừng nhận đơn"}
            </span>
          </div>

          <p className={styles.mobileReceiveDesc}>
            {mobileOpen
              ? "Quán đang mở và có thể nhận đơn mới."
              : "Quán đang tạm ngừng nhận đơn mới."}
          </p>

          <button
            type="button"
            className={styles.mobileReceiveToggleBtn}
            onClick={toggleMobileOperatingStatus}
          >
            <CirclePause size={19} strokeWidth={2.1} aria-hidden="true" />
            <span>{mobileOpen ? "Tạm ngừng nhận đơn" : "Mở nhận đơn"}</span>
          </button>

          <p className={styles.mobileReceiveCaption}>
            Tạm ngừng không làm hủy các đơn đã nhận.
          </p>
        </section>

        {/* Card 3: Thiết lập cửa hàng */}
        <section
          className={styles.mobileSetupCard}
          aria-labelledby="mobile-store-setup-heading"
        >
          <h2 id="mobile-store-setup-heading">Thiết lập cửa hàng</h2>

          <div className={styles.mobileSetupList}>
            <button
              type="button"
              className={styles.mobileSetupRow}
              onClick={() => !isStaff && setMobileSheet("info")}
            >
              <span className={styles.mobileSetupIcon} aria-hidden="true">
                <Store size={21} strokeWidth={2} />
              </span>
              <span className={styles.mobileSetupText}>
                <strong>Thông tin cửa hàng</strong>
                <span>Tên, ảnh, mô tả và số điện thoại</span>
              </span>
              <ChevronRight
                size={19}
                strokeWidth={2}
                className={styles.mobileSetupArrow}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              className={styles.mobileSetupRow}
              onClick={() => !isStaff && setMobileSheet("schedule")}
            >
              <span className={styles.mobileSetupIcon} aria-hidden="true">
                <Clock3 size={21} strokeWidth={2} />
              </span>
              <span className={styles.mobileSetupText}>
                <strong>Giờ hoạt động</strong>
                <span>{mobileScheduleSummary.hoursLine}</span>
                {mobileScheduleSummary.closedLine && (
                  <span>{mobileScheduleSummary.closedLine}</span>
                )}
              </span>
              <ChevronRight
                size={19}
                strokeWidth={2}
                className={styles.mobileSetupArrow}
                aria-hidden="true"
              />
            </button>

            <Link href="/seller/payments" className={styles.mobileSetupRow}>
              <span className={styles.mobileSetupIcon} aria-hidden="true">
                <Wallet size={21} strokeWidth={2} />
              </span>
              <span className={styles.mobileSetupText}>
                <strong>Thanh toán</strong>
                <span>{mobilePaymentSummary}</span>
              </span>
              <ChevronRight
                size={19}
                strokeWidth={2}
                className={styles.mobileSetupArrow}
                aria-hidden="true"
              />
            </Link>
          </div>
        </section>

        {/* Card 4: Quyền giao hàng */}
        <section
          className={styles.mobileDeliveryCard}
          aria-labelledby="mobile-delivery-permission-heading"
        >
          <div className={styles.mobileDeliveryTop}>
            <span className={styles.mobileDeliveryIcon} aria-hidden="true">
              <Truck size={20} strokeWidth={2} />
            </span>
            <div className={styles.mobileDeliveryHeadCopy}>
              <div className={styles.mobileDeliveryTitleRow}>
                <h2 id="mobile-delivery-permission-heading">Quyền giao hàng</h2>
                <span className={styles.mobileDeliveryStatusPill}>
                  Đã tạo liên kết
                </span>
              </div>
              <p>Chia sẻ liên kết để người giao hàng xem đơn cần giao.</p>
            </div>
          </div>

          <div className={styles.mobileDeliveryActions}>
            <button
              type="button"
              className={styles.mobileDeliveryBtn}
              onClick={() =>
                void copy(
                  `${window.location.origin}/delivery/demo/${mobileDeliveryToken}`,
                )
              }
            >
              <Copy size={16} strokeWidth={2.1} aria-hidden="true" />
              <span>Sao chép liên kết</span>
            </button>
            <button
              type="button"
              className={styles.mobileDeliveryBtn}
              onClick={() => !isStaff && setManage(true)}
            >
              <span>Quản lý</span>
              <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>

          <p className={styles.mobileDeliveryWarning}>
            <TriangleAlert
              size={15}
              strokeWidth={2.2}
              className={styles.mobileDeliveryWarnIcon}
              aria-hidden="true"
            />
            <span>Chỉ chia sẻ với người giao hàng tin cậy.</span>
          </p>
        </section>
      </div>

      {/* Mobile Edit Sheets for Thông tin cửa hàng & Giờ hoạt động */}
      {mobileSheet === "info" && !isStaff && (
        <div
          className={styles.staffQrBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-shop-info-sheet-title"
          onClick={() => setMobileSheet(null)}
        >
          <div
            className={styles.mobileSheetModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.mobileSheetHeader}>
              <h2 id="mobile-shop-info-sheet-title">Thông tin cửa hàng</h2>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setMobileSheet(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveInfo} className={styles.mobileSheetForm}>
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
              <label>
                Khu vực / địa điểm <b>*</b>
                <input
                  required
                  maxLength={200}
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </label>
              <label>
                Số điện thoại liên hệ
                <input disabled value="Chưa hỗ trợ lưu ở màn này" readOnly />
              </label>
              <div className={styles.mobileSheetActions}>
                <button
                  type="button"
                  className={styles.outline}
                  onClick={() => setMobileSheet(null)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={styles.primary}
                  disabled={reading || saving}
                >
                  Lưu thông tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mobileSheet === "schedule" && !isStaff && (
        <div
          className={styles.staffQrBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-shop-schedule-sheet-title"
          onClick={() => setMobileSheet(null)}
        >
          <div
            className={styles.mobileSheetModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.mobileSheetHeader}>
              <h2 id="mobile-shop-schedule-sheet-title">Giờ hoạt động</h2>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setMobileSheet(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveSchedule} className={styles.mobileSheetForm}>
              <div className={styles.times}>
                <label>
                  Giờ mở cửa
                  <select
                    required
                    value={opens}
                    onChange={(event) => {
                      setMode("same");
                      setOpens(event.target.value);
                    }}
                  >
                    {timeChoices.map((time) => (
                      <option key={time}>{time}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Giờ đóng cửa
                  <select
                    required
                    value={closes}
                    onChange={(event) => {
                      setMode("same");
                      setCloses(event.target.value);
                    }}
                  >
                    {timeChoices.map((time) => (
                      <option key={time}>{time}</option>
                    ))}
                  </select>
                </label>
              </div>
              <strong className={styles.dayTitle}>Áp dụng cho các ngày</strong>
              <div className={styles.dayChips}>
                {days.map((day, index) => (
                  <label key={day.label} data-active={day.enabled}>
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(event) => {
                        setMode("same");
                        setDays((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? {
                                  ...entry,
                                  enabled: event.target.checked,
                                }
                              : entry,
                          ),
                        );
                      }}
                    />
                    {day.label}
                  </label>
                ))}
              </div>
              <div className={styles.mobileSheetActions}>
                <button
                  type="button"
                  className={styles.outline}
                  onClick={() => setMobileSheet(null)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={styles.primary}
                  disabled={saving}
                >
                  Lưu lịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manage && !isStaff && (
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
