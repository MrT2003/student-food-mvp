"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CookingPot,
  Eye,
  ImagePlus,
  Lightbulb,
  Pencil,
  Plus,
  Save,
  Settings2,
  Store,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import FoodThumbnail from "@/components/ui/FoodThumbnail";
import SellerSidebar from "./SellerSidebar";
import { useSellerPreview } from "@/store/useSellerPreviewStore";
import { useSellerMenuStore } from "@/store/useSellerMenuStore";
import { demoSellerRestaurant } from "@/lib/mocks/seller-orders.mock";
import { menuCategories, type SellerMenuRow } from "@/lib/seller/menu";
import { formatMoney, normalizeSearchText } from "@/lib/format";
import { CloudinaryService } from "@/services/cloudinary.service";
import type { MenuOptionGroupDetail } from "@/types/restaurant.types";
import shell from "@/styles/seller-menu.module.css";
import styles from "@/styles/seller-menu-create.module.css";

export type DraftOption = {
  id: string;
  option_name: string;
  additional_price: number;
};

export type DraftGroup = {
  id: string;
  name: string;
  is_multiple: boolean;
  is_required: boolean;
  options: DraftOption[];
};

type Editor =
  | { type: "group"; group?: DraftGroup; target?: "desktop" | "mobile" }
  | {
      type: "option";
      groupId: string;
      option?: DraftOption;
      target?: "desktop" | "mobile";
    };

export type SellerMobileSellingStatus = "selling" | "unavailable" | "hidden";

export const DEFAULT_SELLER_MOBILE_CREATE_IMAGE =
  "/seller-menu-create-tra-sua.png";

export const DEFAULT_SELLER_MOBILE_CREATE_VALUES = {
  name: "Trà sữa truyền thống",
  price: 20000,
  category: "Đồ uống",
  description: "Trà sữa thơm béo, trân châu đen dai mềm.",
  image_url: DEFAULT_SELLER_MOBILE_CREATE_IMAGE,
  is_active: true,
  is_available: true,
  featured: false,
} as const;

export function createDefaultSellerMobileOptionGroups(): DraftGroup[] {
  return [
    {
      id: "mobile-group-topping",
      name: "Topping thêm",
      is_multiple: true,
      is_required: false,
      options: [
        {
          id: "mobile-opt-topping-1",
          option_name: "Trân châu đen",
          additional_price: 5000,
        },
        {
          id: "mobile-opt-topping-2",
          option_name: "Thạch trái cây",
          additional_price: 4000,
        },
        {
          id: "mobile-opt-topping-3",
          option_name: "Pudding",
          additional_price: 6000,
        },
      ],
    },
    {
      id: "mobile-group-sugar",
      name: "Mức đường",
      is_multiple: false,
      is_required: true,
      options: [
        { id: "mobile-opt-sugar-100", option_name: "100%", additional_price: 0 },
        { id: "mobile-opt-sugar-70", option_name: "70%", additional_price: 0 },
        { id: "mobile-opt-sugar-50", option_name: "50%", additional_price: 0 },
        { id: "mobile-opt-sugar-30", option_name: "30%", additional_price: 0 },
        { id: "mobile-opt-sugar-0", option_name: "0%", additional_price: 0 },
      ],
    },
    {
      id: "mobile-group-ice",
      name: "Mức đá",
      is_multiple: false,
      is_required: true,
      options: [
        {
          id: "mobile-opt-ice-normal",
          option_name: "Bình thường",
          additional_price: 0,
        },
        {
          id: "mobile-opt-ice-less",
          option_name: "Ít đá",
          additional_price: 0,
        },
        {
          id: "mobile-opt-ice-none",
          option_name: "Không đá",
          additional_price: 0,
        },
      ],
    },
  ];
}

export function formatSellerMobilePriceInput(
  rawPrice: string | number,
): string {
  const digits = String(rawPrice ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  const numeric = Number(digits);
  if (!Number.isFinite(numeric)) return "";
  return numeric.toLocaleString("vi-VN");
}

export function parseSellerMobilePriceInput(value: string): string {
  return value.replace(/\D+/g, "");
}

export function formatSellerMobileOptionGroupSubtitle(
  group: Pick<DraftGroup, "is_multiple" | "options">,
): string {
  const modeLabel = group.is_multiple ? "Chọn nhiều" : "Chọn một";
  return `${modeLabel} · ${group.options.length} lựa chọn`;
}

export function formatSellerMobileOptionGroupPriceBadge(
  group: Pick<DraftGroup, "options">,
): string | null {
  const positivePrices = group.options
    .map((opt) => opt.additional_price)
    .filter((price) => price > 0);
  if (positivePrices.length === 0) return null;
  const minPrice = Math.min(...positivePrices);
  const maxPrice = Math.max(...positivePrices);
  if (minPrice === maxPrice) {
    return `+${formatSellerMobilePriceInput(minPrice)}đ`;
  }
  return `+${formatSellerMobilePriceInput(minPrice)} – ${formatSellerMobilePriceInput(maxPrice)}đ`;
}

export function resolveSellerMobileSellingStatus(
  active: boolean,
  outOfStock: boolean,
): SellerMobileSellingStatus {
  if (!active) return "hidden";
  if (outOfStock) return "unavailable";
  return "selling";
}

export function applySellerMobileSellingStatus(
  status: SellerMobileSellingStatus,
): { active: boolean; outOfStock: boolean } {
  if (status === "selling") {
    return { active: true, outOfStock: false };
  }
  if (status === "unavailable") {
    return { active: true, outOfStock: true };
  }
  return { active: false, outOfStock: false };
}

export function PhotoUploadSvgIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <circle cx="8.5" cy="8.5" r="1.7" fill="currentColor" />
      <path
        d="M3.8 17.5 9.2 12.4a1.2 1.2 0 0 1 1.7 0l3.1 3 2.1-2a1.2 1.2 0 0 1 1.7 0l2.4 2.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DrinkCategorySvgIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13 3.2 14.8 7.5"
        stroke="#ef5322"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M6.2 7.5h11.6"
        stroke="#ef5322"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.6 7.5 8.8 19.3a1.6 1.6 0 0 0 1.6 1.4h3.2a1.6 1.6 0 0 0 1.6-1.4L16.4 7.5"
        fill="#fff1ea"
        stroke="#ef5322"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <path
        d="M8.3 12.6h7.4"
        stroke="#ef5322"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ToppingGroupSvgIcon({ size = 23 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="9"
        cy="14.5"
        r="4.2"
        fill="#eef4ff"
        stroke="#1e4fa3"
        strokeWidth="1.75"
      />
      <circle
        cx="15.5"
        cy="13.8"
        r="3.8"
        fill="#eef4ff"
        stroke="#1e4fa3"
        strokeWidth="1.75"
      />
      <circle
        cx="12.2"
        cy="8.5"
        r="3.8"
        fill="#eef4ff"
        stroke="#1e4fa3"
        strokeWidth="1.75"
      />
      <circle cx="8.3" cy="14" r="0.9" fill="#1e4fa3" />
      <circle cx="15.2" cy="13.5" r="0.9" fill="#1e4fa3" />
      <circle cx="11.8" cy="8.1" r="0.9" fill="#1e4fa3" />
    </svg>
  );
}

export function SugarGroupSvgIcon({ size = 23 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8.5 9.2 13 6.7l4.5 2.5v5.2L13 16.9l-4.5-2.5V9.2Z"
        fill="#eef4ff"
        stroke="#1e4fa3"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 9.2 13 11.7l4.5-2.5M13 11.7v5.2"
        stroke="#1e4fa3"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.2 13.2 8 11.1l3.8 2.1v4.3L8 19.6l-3.8-2.1v-4.3Z"
        fill="#ffffff"
        stroke="#1e4fa3"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M4.2 13.2 8 15.3l3.8-2.1M8 15.3v4.3"
        stroke="#1e4fa3"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IceGroupSvgIcon({ size = 23 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="8.2"
        y="4.5"
        width="7.6"
        height="7.2"
        rx="1.8"
        fill="#eef4ff"
        stroke="#1e4fa3"
        strokeWidth="1.75"
      />
      <rect
        x="4.2"
        y="12"
        width="7.6"
        height="7.2"
        rx="1.8"
        fill="#eef4ff"
        stroke="#1e4fa3"
        strokeWidth="1.75"
      />
      <rect
        x="12.2"
        y="12"
        width="7.6"
        height="7.2"
        rx="1.8"
        fill="#eef4ff"
        stroke="#1e4fa3"
        strokeWidth="1.75"
      />
      <path
        d="M10.4 6.8h2.2M6.4 14.3h2.2M14.4 14.3h2.2"
        stroke="#1e4fa3"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Icon SVG đại diện cho "Hiển thị thực đơn" trong section "Hiển thị & tình trạng bán"
 */
export function MenuVisibilitySvgIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      data-testid="icon-menu-visibility"
    >
      <path
        d="M2.2 12s3.6-6.5 9.8-6.5 9.8 6.5 9.8 6.5-3.6 6.5-9.8 6.5S2.2 12 2.2 12Z"
        stroke="#1e4fa3"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="#1e4fa3"
        strokeWidth="1.85"
      />
    </svg>
  );
}

/**
 * Icon SVG đại diện cho "Tình trạng bán" trong section "Hiển thị & tình trạng bán"
 */
export function SellingStatusSvgIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      data-testid="icon-selling-status"
    >
      <path
        d="M3.5 9.5 5.2 4.5h13.6l1.7 5"
        stroke="#1e4fa3"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 9.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5"
        stroke="#1e4fa3"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 12v7.2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12"
        stroke="#1e4fa3"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 20.2v-4.8h4v4.8"
        stroke="#1e4fa3"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Icon SVG đại diện cho "Món nổi bật" trong section "Hiển thị & tình trạng bán"
 */
export function FeaturedDishSvgIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      data-testid="icon-featured-dish"
    >
      <path
        d="m12 3.3 2.68 5.43 6 .87-4.34 4.23 1.02 5.97L12 17l-5.36 2.8 1.02-5.97-4.34-4.23 6-.87L12 3.3Z"
        stroke="#1e4fa3"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SaveDishSvgIcon({ size = 19 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 4h11.2L20 7.8V19a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 19V5.8A1.8 1.8 0 0 1 5.8 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8 4v5h7V4M8 20.5v-6h8v6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getMobileOptionGroupIcon(groupName: string) {
  const normalized = normalizeSearchText(groupName);
  if (normalized.includes("duong")) {
    return <SugarGroupSvgIcon />;
  }
  if (normalized.includes("da")) {
    return <IceGroupSvgIcon />;
  }
  return <ToppingGroupSvgIcon />;
}

function OptionEditor({
  editor,
  onClose,
  onSave,
}: {
  editor: Editor;
  onClose: () => void;
  onSave: (values: {
    name: string;
    multiple: boolean;
    required: boolean;
    price: number;
  }) => string | void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const price = Number(data.get("price") ?? 0);
    if (!name || !Number.isSafeInteger(price) || price < 0 || price > 10000000) {
      setError("Nhập tên hợp lệ và giá nguyên từ 0 đến 10.000.000đ.");
      return;
    }
    const message = onSave({
      name,
      price,
      multiple: data.get("multiple") === "true",
      required: data.has("required"),
    });
    if (message) setError(message);
  }
  const group = editor.type === "group" ? editor.group : undefined;
  const option = editor.type === "option" ? editor.option : undefined;
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      aria-labelledby="option-editor-title"
    >
      <form onSubmit={submit}>
        <header>
          <h2 id="option-editor-title">
            {editor.type === "group"
              ? `${group ? "Sửa" : "Thêm"} nhóm tùy chọn`
              : `${option ? "Sửa" : "Thêm"} lựa chọn`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </header>
        <label>
          Tên {editor.type === "group" ? "nhóm" : "lựa chọn"}
          <input
            autoFocus
            required
            maxLength={80}
            name="name"
            defaultValue={group?.name ?? option?.option_name ?? ""}
          />
        </label>
        {editor.type === "group" ? (
          <>
            <label>
              Kiểu chọn
              <select
                name="multiple"
                defaultValue={String(group?.is_multiple ?? true)}
              >
                <option value="true">Chọn nhiều</option>
                <option value="false">Chọn một</option>
              </select>
            </label>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                name="required"
                defaultChecked={group?.is_required ?? false}
              />
              Bắt buộc chọn
            </label>
          </>
        ) : (
          <label>
            Giá cộng thêm (đ)
            <input
              name="price"
              type="number"
              min={0}
              max={10000000}
              step={1}
              required
              defaultValue={option?.additional_price ?? 0}
            />
          </label>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" className={styles.outline} onClick={onClose}>
            Hủy
          </button>
          <button className={styles.primary} type="submit">
            Lưu
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export default function SellerMenuCreateView({ itemId }: { itemId?: string }) {
  const row = useSellerMenuStore((state) =>
    state.rows.find((entry) => entry.item.id === itemId),
  );
  const router = useRouter();
  if (itemId && !row)
    return (
      <div className={shell.page}>
        <StudentHeader variant="seller" />
        <main className={shell.workspace}>
          <SellerSidebar active="menu" name={demoSellerRestaurant.name} />
          <section className={styles.card}>
            <h1>Không tìm thấy món ăn</h1>
            <p>
              Món có thể đã bị xóa hoặc dữ liệu demo đã mất khi tải lại trang.
            </p>
            <button
              className={styles.outline}
              onClick={() => router.push("/seller/menu")}
            >
              Quay lại Menu
            </button>
          </section>
        </main>
      </div>
    );
  return (
    <SellerMenuForm
      key={itemId ?? "new"}
      original={itemId ? row : undefined}
    />
  );
}

function SellerMenuForm({ original }: { original?: SellerMenuRow }) {
  const router = useRouter();
  const seller = useSellerPreview();
  const rows = useSellerMenuStore((state) => state.rows);
  const setRows = useSellerMenuStore((state) => state.setRows);
  const shopName = seller?.name || demoSellerRestaurant.name;
  const categories = [
    ...new Set([
      ...menuCategories,
      ...rows
        .map(({ item }) => item.category)
        .filter((value): value is string => Boolean(value)),
    ]),
  ];

  // Desktop state (100% preserved)
  const [name, setName] = useState(original?.item.name ?? "");
  const [category, setCategory] = useState(
    original?.item.category ?? "Đồ uống",
  );
  const [price, setPrice] = useState(original ? String(original.item.price) : "");
  const [description, setDescription] = useState(
    original?.item.description ?? "",
  );
  const [image, setImage] = useState<string | null>(
    original?.item.image_url ?? null,
  );
  const [readingImage, setReadingImage] = useState(false);
  const [groups, setGroups] = useState<DraftGroup[]>(
    () =>
      original?.optionGroups?.map((group) => ({
        id: group.id,
        name: group.name,
        is_multiple: group.is_multiple,
        is_required: group.is_required,
        options: group.options.map((option) => ({
          id: option.id,
          option_name: option.option_name,
          additional_price: option.additional_price,
        })),
      })) ?? [],
  );
  const [groupsChanged, setGroupsChanged] = useState(false);
  const [active, setActive] = useState(original?.item.is_active ?? true);
  const [outOfStock, setOutOfStock] = useState(
    original ? !original.item.is_available : false,
  );
  const [featured, setFeatured] = useState(original?.featuredPreview ?? false);

  // Mobile state (matching mockup 100%)
  const [mobileName, setMobileName] = useState(
    original?.item.name ?? DEFAULT_SELLER_MOBILE_CREATE_VALUES.name,
  );
  const [mobileCategory, setMobileCategory] = useState(
    original?.item.category ?? DEFAULT_SELLER_MOBILE_CREATE_VALUES.category,
  );
  const [mobilePrice, setMobilePrice] = useState(
    original
      ? String(original.item.price)
      : String(DEFAULT_SELLER_MOBILE_CREATE_VALUES.price),
  );
  const [mobileDescription, setMobileDescription] = useState(
    original?.item.description ??
      DEFAULT_SELLER_MOBILE_CREATE_VALUES.description,
  );
  const [mobileImage, setMobileImage] = useState<string>(
    original?.item.image_url || DEFAULT_SELLER_MOBILE_CREATE_IMAGE,
  );
  const [mobileGroups, setMobileGroups] = useState<DraftGroup[]>(
    () =>
      original?.optionGroups?.map((group) => ({
        id: group.id,
        name: group.name,
        is_multiple: group.is_multiple,
        is_required: group.is_required,
        options: group.options.map((option) => ({
          id: option.id,
          option_name: option.option_name,
          additional_price: option.additional_price,
        })),
      })) ?? createDefaultSellerMobileOptionGroups(),
  );
  const [mobileActive, setMobileActive] = useState(
    original?.item.is_active ?? DEFAULT_SELLER_MOBILE_CREATE_VALUES.is_active,
  );
  const [mobileOutOfStock, setMobileOutOfStock] = useState(
    original
      ? !original.item.is_available
      : !DEFAULT_SELLER_MOBILE_CREATE_VALUES.is_available,
  );
  const [mobileFeatured, setMobileFeatured] = useState(
    original?.featuredPreview ?? DEFAULT_SELLER_MOBILE_CREATE_VALUES.featured,
  );
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitted = useRef(false);
  const uploadRequestId = useRef(0);
  const preview = useRef<HTMLElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const mobileUpload = useRef<HTMLInputElement>(null);
  const initial = useRef(
    JSON.stringify({
      name,
      category,
      price,
      description,
      image,
      groups,
      active,
      outOfStock,
      featured,
    }),
  );
  const mobileInitial = useRef(
    JSON.stringify({
      mobileName,
      mobileCategory,
      mobilePrice,
      mobileDescription,
      mobileImage,
      mobileGroups,
      mobileActive,
      mobileOutOfStock,
      mobileFeatured,
    }),
  );

  const basePrice = Number(price) || 0;
  const status = !active ? "Đang ẩn" : outOfStock ? "Tạm hết" : "Đang bán";
  const mobileBasePrice = Number(mobilePrice) || 0;
  const mobileSellingStatus = resolveSellerMobileSellingStatus(
    mobileActive,
    mobileOutOfStock,
  );
  const mobileStatusLabel =
    mobileSellingStatus === "hidden"
      ? "Đang ẩn"
      : mobileSellingStatus === "unavailable"
        ? "Tạm hết"
        : "Đang bán";

  async function readImage(file?: File, target: "desktop" | "mobile" = "desktop") {
    if (!file) return;
    const requestId = ++uploadRequestId.current;
    setReadingImage(true);
    setError("");
    try {
      const uploaded = await CloudinaryService.uploadImage(file, {
        folder: "student-food/menu-items",
      });
      if (uploadRequestId.current === requestId) {
        if (target === "mobile") {
          setMobileImage(uploaded.secureUrl);
        } else {
          setImage(uploaded.secureUrl);
        }
      }
    } catch (err) {
      if (uploadRequestId.current === requestId) {
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải ảnh lên Cloudinary. Hãy chọn lại.",
        );
      }
    } finally {
      if (uploadRequestId.current === requestId) {
        setReadingImage(false);
      }
    }
  }

  function saveEditor(values: {
    name: string;
    multiple: boolean;
    required: boolean;
    price: number;
  }): string | void {
    if (!editor) return;
    const isMobileTarget = editor.target === "mobile";
    const activeGroups = isMobileTarget ? mobileGroups : groups;
    const updateActiveGroups = isMobileTarget ? setMobileGroups : setGroups;

    const sameName = (a: string) =>
      normalizeSearchText(a) === normalizeSearchText(values.name);
    if (editor.type === "group") {
      if (
        activeGroups.some(
          (group) => group.id !== editor.group?.id && sameName(group.name),
        )
      )
        return "Tên nhóm đã tồn tại.";
      const defaultOptions: DraftOption[] =
        isMobileTarget && !editor.group
          ? [
              {
                id: crypto.randomUUID(),
                option_name: "Lựa chọn 1",
                additional_price: 0,
              },
            ]
          : [];
      const group: DraftGroup = {
        id: editor.group?.id ?? crypto.randomUUID(),
        name: values.name,
        is_multiple: values.multiple,
        is_required: values.required,
        options: editor.group?.options ?? defaultOptions,
      };
      updateActiveGroups((current) =>
        editor.group
          ? current.map((entry) => (entry.id === group.id ? group : entry))
          : [...current, group],
      );
    } else {
      const group = activeGroups.find((entry) => entry.id === editor.groupId);
      if (!group) return "Nhóm tùy chọn không còn tồn tại.";
      if (
        group.options.some(
          (option) =>
            option.id !== editor.option?.id && sameName(option.option_name),
        )
      )
        return "Lựa chọn đã tồn tại trong nhóm này.";
      const option: DraftOption = {
        id: editor.option?.id ?? crypto.randomUUID(),
        option_name: values.name,
        additional_price: values.price,
      };
      updateActiveGroups((current) =>
        current.map((entry) =>
          entry.id !== editor.groupId
            ? entry
            : {
                ...entry,
                options: editor.option
                  ? entry.options.map((value) =>
                      value.id === option.id ? option : value,
                    )
                  : [...entry.options, option],
              },
        ),
      );
    }
    if (!isMobileTarget) {
      setGroupsChanged(true);
    }
    setEditor(null);
  }

  function beverageTemplate() {
    setGroupsChanged(true);
    const templates: [string, boolean, string[], number[]][] = [
      [
        "Topping thêm",
        true,
        ["Trân châu đen", "Thạch trái cây", "Pudding"],
        [5000, 4000, 6000],
      ],
      ["Mức đường", false, ["100%", "70%", "50%", "30%", "0%"], [0, 0, 0, 0, 0]],
      ["Mức đá", false, ["Bình thường", "Ít đá", "Không đá"], [0, 0, 0]],
    ];
    setGroups(
      templates.map(([name, multiple, names, prices]) => ({
        id: crypto.randomUUID(),
        name,
        is_multiple: multiple,
        is_required: !multiple,
        options: names.map((option_name, index) => ({
          id: crypto.randomUUID(),
          option_name,
          additional_price: prices[index],
        })),
      })),
    );
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    if (
      original &&
      !useSellerMenuStore
        .getState()
        .rows.some((row) => row.item.id === original.item.id)
    ) {
      setError("Món này đã bị xóa. Hãy quay lại Menu.");
      return;
    }
    if (
      readingImage ||
      (!image && (!original || Boolean(original.item.image_url))) ||
      !name.trim() ||
      !category ||
      !price.trim() ||
      !Number.isSafeInteger(basePrice) ||
      basePrice < 0 ||
      basePrice > 10000000
    ) {
      setError(
        "Vui lòng chọn ảnh hợp lệ, nhập tên, danh mục và giá nguyên từ 0 đến 10.000.000đ.",
      );
      return;
    }
    if (groups.some((group) => !group.options.length)) {
      setError("Mỗi nhóm cần ít nhất một lựa chọn, hoặc hãy xóa nhóm trống.");
      return;
    }
    submitted.current = true;
    setSaving(true);
    const id = original?.item.id ?? crypto.randomUUID(),
      now = new Date().toISOString();
    const optionGroups: MenuOptionGroupDetail[] = groups.map((group) => {
      const previous = original?.optionGroups?.find(
        (entry) => entry.id === group.id,
      );
      return {
        ...group,
        menu_item_id: id,
        is_active: previous?.is_active ?? true,
        created_at: previous?.created_at ?? now,
        updated_at: now,
        options: group.options.map((option) => {
          const previousOption = previous?.options.find(
            (entry) => entry.id === option.id,
          );
          return {
            ...option,
            group_id: group.id,
            is_active: previousOption?.is_active ?? true,
            created_at: previousOption?.created_at ?? now,
            updated_at: now,
          };
        }),
      };
    });
    // Data URLs and featuredPreview are demo-only. Production uploads must provide a storage URL.
    const updated: SellerMenuRow = {
      item: {
        id,
        restaurant_id: original?.item.restaurant_id ?? demoSellerRestaurant.id,
        name: name.trim(),
        category,
        price: basePrice,
        description: description.trim() || null,
        image_url: image,
        slug:
          original?.item.slug ??
          `${
            normalizeSearchText(name.trim())
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "mon"
          }-${id.slice(0, 8)}`,
        is_active: active,
        is_available: !outOfStock,
        created_at: original?.item.created_at ?? now,
        updated_at: now,
      },
      optionGroups:
        original && !original.optionGroups && !groupsChanged
          ? undefined
          : optionGroups,
      optionCount:
        original && !original.optionGroups && !groupsChanged
          ? original.optionCount
          : groups.reduce((count, group) => count + group.options.length, 0),
      featuredPreview: featured,
    };
    setRows((current) =>
      original
        ? current.map((row) => (row.item.id === id ? updated : row))
        : [updated, ...current],
    );
    router.push("/seller/menu");
  }

  function saveMobile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    if (
      original &&
      !useSellerMenuStore
        .getState()
        .rows.some((row) => row.item.id === original.item.id)
    ) {
      setError("Món này đã bị xóa. Hãy quay lại Menu.");
      return;
    }
    if (
      readingImage ||
      !mobileImage ||
      !mobileName.trim() ||
      !mobileCategory ||
      !mobilePrice.trim() ||
      !Number.isSafeInteger(mobileBasePrice) ||
      mobileBasePrice < 0 ||
      mobileBasePrice > 10000000
    ) {
      setError(
        "Vui lòng chọn ảnh hợp lệ, nhập tên, danh mục và giá nguyên từ 0 đến 10.000.000đ.",
      );
      return;
    }
    submitted.current = true;
    setSaving(true);
    const id = original?.item.id ?? crypto.randomUUID(),
      now = new Date().toISOString();
    const optionGroups: MenuOptionGroupDetail[] = mobileGroups.map((group) => ({
      ...group,
      menu_item_id: id,
      is_active: true,
      created_at: now,
      updated_at: now,
      options: group.options.map((option) => ({
        ...option,
        group_id: group.id,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
    }));
    const updated: SellerMenuRow = {
      item: {
        id,
        restaurant_id: original?.item.restaurant_id ?? demoSellerRestaurant.id,
        name: mobileName.trim(),
        category: mobileCategory,
        price: mobileBasePrice,
        description: mobileDescription.trim() || null,
        image_url: mobileImage,
        slug:
          original?.item.slug ??
          `${
            normalizeSearchText(mobileName.trim())
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "mon"
          }-${id.slice(0, 8)}`,
        is_active: mobileActive,
        is_available: !mobileOutOfStock,
        created_at: original?.item.created_at ?? now,
        updated_at: now,
      },
      optionGroups,
      optionCount: mobileGroups.length,
      featuredPreview: mobileFeatured,
    };
    setRows((current) =>
      original
        ? current.map((row) => (row.item.id === id ? updated : row))
        : [updated, ...current],
    );
    router.push("/seller/menu");
  }

  function cancel() {
    if (
      JSON.stringify({
        name,
        category,
        price,
        description,
        image,
        groups,
        active,
        outOfStock,
        featured,
      }) !== initial.current &&
      !window.confirm("Hủy các thông tin món chưa lưu?")
    )
      return;
    router.push("/seller/menu");
  }

  function cancelMobile() {
    if (
      JSON.stringify({
        mobileName,
        mobileCategory,
        mobilePrice,
        mobileDescription,
        mobileImage,
        mobileGroups,
        mobileActive,
        mobileOutOfStock,
        mobileFeatured,
      }) !== mobileInitial.current &&
      typeof window !== "undefined" &&
      typeof window.confirm === "function" &&
      !window.confirm("Hủy các thông tin món chưa lưu?")
    )
      return;
    router.push("/seller/menu");
  }

  const saveButton = (
    <button
      type="submit"
      className={styles.primary}
      disabled={saving || readingImage}
    >
      <Save size={20} />
      {saving ? "Đang lưu…" : "Lưu món"}
    </button>
  );

  return (
    <div className={`${shell.page} ${styles.page}`}>
      <StudentHeader variant="seller" />
      <div className={`${shell.workspace} ${styles.workspace}`}>
        <SellerSidebar active="menu" name={shopName} menuLabel="Thực đơn" />
        <main className={styles.main}>
          {/* Phiên bản Desktop giữ nguyên 100% */}
          <div className={styles.desktopView}>
            <form onSubmit={save}>
              <header className={styles.heading}>
                <div>
                  <h1>{original ? "Chỉnh sửa món" : "Thêm món mới"}</h1>
                  <p>
                    {original
                      ? "Cập nhật thông tin món ăn trên menu cửa hàng của bạn."
                      : "Tạo món mới để hiển thị trên menu cửa hàng của bạn."}
                  </p>
                </div>
                <div className={styles.buttons}>
                  <button
                    type="button"
                    className={styles.outline}
                    onClick={() =>
                      preview.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      })
                    }
                  >
                    <Eye size={20} />
                    Xem trước
                  </button>
                  {saveButton}
                </div>
              </header>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <div className={styles.columns}>
                <div className={styles.left}>
                  <section className={styles.card}>
                    <h2>Thông tin cơ bản</h2>
                    <div className={styles.basic}>
                      <div className={styles.uploadField}>
                        <span>
                          Ảnh món{" "}
                          {(!original || original.item.image_url) && <b>*</b>}
                        </span>
                        <button
                          type="button"
                          className={styles.upload}
                          onClick={() => upload.current?.click()}
                          aria-label="Tải hoặc thay ảnh món ăn"
                        >
                          {image ? (
                            <Image
                              src={image}
                              alt="Ảnh món đã chọn"
                              width={300}
                              height={220}
                              unoptimized
                            />
                          ) : (
                            <>
                              <ImagePlus size={42} />
                              <strong>
                                {readingImage
                                  ? "Đang tải ảnh lên Cloudinary…"
                                  : "Tải ảnh món ăn"}
                              </strong>
                              <small>JPG, PNG, WEBP tối đa 5MB</small>
                            </>
                          )}
                        </button>
                        <input
                          ref={upload}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          hidden
                          onChange={(event) => {
                            void readImage(event.target.files?.[0], "desktop");
                            event.target.value = "";
                          }}
                        />
                        {image && (
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() => {
                              uploadRequestId.current++;
                              setReadingImage(false);
                              setImage(null);
                            }}
                          >
                            Xóa ảnh
                          </button>
                        )}
                      </div>
                      <div className={styles.fields}>
                        <label>
                          Tên món <b>*</b>
                          <input
                            required
                            maxLength={120}
                            placeholder="Ví dụ: Trà sữa truyền thống"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                          />
                        </label>
                        <label>
                          Danh mục <b>*</b>
                          <select
                            required
                            value={category}
                            onChange={(event) =>
                              setCategory(event.target.value)
                            }
                          >
                            {categories.map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Giá bán <b>*</b>
                          <div className={styles.priceInput}>
                            <input
                              required
                              type="number"
                              min={0}
                              max={10000000}
                              step={1}
                              placeholder="Nhập giá bán"
                              value={price}
                              onChange={(event) => setPrice(event.target.value)}
                            />
                            <span>đ</span>
                          </div>
                        </label>
                        <label>
                          Mô tả ngắn
                          <div className={styles.description}>
                            <textarea
                              maxLength={160}
                              placeholder="Giới thiệu ngắn về món ăn của bạn…"
                              value={description}
                              onChange={(event) =>
                                setDescription(event.target.value)
                              }
                            />
                            <small>{description.length}/160</small>
                          </div>
                        </label>
                      </div>
                    </div>
                  </section>
                  <section className={styles.card}>
                    <div className={styles.sectionHeading}>
                      <h2>Tùy chọn món</h2>
                      <p>
                        Tạo các nhóm topping, mức đường, mức đá hoặc món thêm.
                      </p>
                    </div>
                    {original &&
                      !original.optionGroups &&
                      original.optionCount > 0 &&
                      !groupsChanged && (
                        <p className={styles.demo}>
                          Món mẫu chỉ có số lượng {original.optionCount} tùy
                          chọn, chưa có dữ liệu chi tiết. Số lượng này được giữ
                          nguyên nếu bạn không thêm nhóm mới.
                        </p>
                      )}
                    {!groups.length && (
                      <div className={styles.empty}>
                        <p>Món không có tùy chọn vẫn có thể lưu.</p>
                        <button
                          type="button"
                          className={styles.outline}
                          onClick={beverageTemplate}
                        >
                          Dùng mẫu đồ uống
                        </button>
                      </div>
                    )}
                    <div className={styles.groups}>
                      {groups.map((group) => (
                        <article key={group.id} className={styles.group}>
                          <header>
                            <strong>{group.name}</strong>
                            <span>
                              {group.is_multiple ? "Chọn nhiều" : "Chọn một"}
                              {group.is_required ? " · Bắt buộc" : ""}
                            </span>
                            <div className={styles.groupActions}>
                              <button
                                type="button"
                                aria-label={`Sửa nhóm ${group.name}`}
                                onClick={() =>
                                  setEditor({
                                    type: "group",
                                    group,
                                    target: "desktop",
                                  })
                                }
                              >
                                <Pencil size={17} />
                              </button>
                              <button
                                type="button"
                                aria-label={`Xóa nhóm ${group.name}`}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Xóa nhóm “${group.name}” và các lựa chọn?`,
                                    )
                                  ) {
                                    setGroupsChanged(true);
                                    setGroups((current) =>
                                      current.filter(
                                        (entry) => entry.id !== group.id,
                                      ),
                                    );
                                  }
                                }}
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </header>
                          <div className={styles.chips}>
                            {group.options.map((option) => (
                              <span key={option.id} className={styles.chip}>
                                <button
                                  type="button"
                                  title="Chỉnh sửa lựa chọn"
                                  onClick={() =>
                                    setEditor({
                                      type: "option",
                                      groupId: group.id,
                                      option,
                                      target: "desktop",
                                    })
                                  }
                                >
                                  {option.option_name}
                                  {option.additional_price > 0 && (
                                    <b>+{formatMoney(option.additional_price)}</b>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Xóa ${option.option_name} trong ${group.name}`}
                                  onClick={() => {
                                    setGroupsChanged(true);
                                    setGroups((current) =>
                                      current.map((entry) =>
                                        entry.id === group.id
                                          ? {
                                              ...entry,
                                              options: entry.options.filter(
                                                (value) =>
                                                  value.id !== option.id,
                                              ),
                                            }
                                          : entry,
                                      ),
                                    );
                                  }}
                                >
                                  <X size={14} />
                                </button>
                              </span>
                            ))}
                            <button
                              type="button"
                              className={styles.addChoice}
                              onClick={() =>
                                setEditor({
                                  type: "option",
                                  groupId: group.id,
                                  target: "desktop",
                                })
                              }
                            >
                              <Plus size={16} />
                              Thêm lựa chọn
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={styles.addGroup}
                      onClick={() =>
                        setEditor({ type: "group", target: "desktop" })
                      }
                    >
                      <Plus size={21} />
                      Thêm nhóm tùy chọn
                    </button>
                  </section>
                  <section className={styles.card}>
                    <h2>Trạng thái hiển thị</h2>
                    <div className={styles.switches}>
                      {[
                        {
                          label: "Đang bán",
                          text: "Hiển thị cho sinh viên",
                          value: active,
                          change: setActive,
                        },
                        {
                          label: "Tạm hết",
                          text: "Không thể đặt nhưng vẫn giữ trong menu",
                          value: outOfStock,
                          change: setOutOfStock,
                        },
                        {
                          label: "Món nổi bật",
                          text: "Chỉ xem trước trong demo, chưa lưu DB",
                          value: featured,
                          change: setFeatured,
                        },
                      ].map((entry) => (
                        <label key={entry.label} className={styles.switchLabel}>
                          <input
                            type="checkbox"
                            role="switch"
                            checked={entry.value}
                            onChange={(event) =>
                              entry.change(event.target.checked)
                            }
                          />
                          <span>
                            <strong>{entry.label}</strong>
                            <small>{entry.text}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                </div>
                <aside className={styles.right}>
                  <section ref={preview} className={styles.card}>
                    <h2>Xem trước với sinh viên</h2>
                    <div className={styles.preview}>
                      <div className={styles.previewImage}>
                        {image ? (
                          <Image
                            src={image}
                            width={120}
                            height={150}
                            alt={name || "Ảnh món"}
                            unoptimized
                          />
                        ) : (
                          <FoodThumbnail
                            kind={category === "Đồ uống" ? "drink" : "food"}
                          />
                        )}
                      </div>
                      <div className={styles.previewCopy}>
                        <div>
                          <h3>{name.trim() || "Tên món của bạn"}</h3>
                          <strong className={styles.money}>
                            {formatMoney(basePrice)}
                          </strong>
                        </div>
                        <p>
                          <Settings2 size={16} />
                          {groups.length
                            ? "Có tùy chọn thêm"
                            : "Không có tùy chọn"}
                        </p>
                        <p>
                          <Store size={16} />
                          {shopName}
                        </p>
                        <footer>
                          <span
                            className={styles.badge}
                            data-selling={active && !outOfStock}
                          >
                            ● {status}
                          </span>
                          <button
                            type="button"
                            className={styles.outline}
                            onClick={() =>
                              setError(
                                "Đây là thẻ xem trước. Món demo chưa được nối vào trang chi tiết của sinh viên.",
                              )
                            }
                          >
                            Xem món
                          </button>
                        </footer>
                      </div>
                    </div>
                    {description && (
                      <p className={styles.previewDescription}>{description}</p>
                    )}
                  </section>
                  <section className={styles.card}>
                    <h2>Tóm tắt</h2>
                    <dl className={styles.summary}>
                      <div>
                        <dt>
                          <Tag size={18} />
                          Danh mục
                        </dt>
                        <dd>{category}</dd>
                      </div>
                      <div>
                        <dt>
                          <Tag size={18} />
                          Giá gốc
                        </dt>
                        <dd>{formatMoney(basePrice)}</dd>
                      </div>
                      <div>
                        <dt>
                          <ClipboardList size={18} />
                          Số nhóm tùy chọn
                        </dt>
                        <dd>{groups.length}</dd>
                      </div>
                      <div>
                        <dt>
                          <Eye size={18} />
                          Trạng thái
                        </dt>
                        <dd>{status}</dd>
                      </div>
                    </dl>
                  </section>
                  <section className={styles.card}>
                    <h2 className={styles.tipsHeading}>
                      <Lightbulb />
                      Gợi ý hoàn thiện
                    </h2>
                    {[
                      {
                        label: "Thêm ảnh món",
                        text: "Ảnh rõ nét giúp món ăn thu hút hơn.",
                        done: Boolean(image),
                      },
                      {
                        label: "Viết mô tả ngắn",
                        text: "Giúp sinh viên dễ lựa chọn.",
                        done: Boolean(description.trim()),
                      },
                      {
                        label: "Tạo nhóm tùy chọn",
                        text: "Thêm topping, mức đường, mức đá nếu có.",
                        done: groups.length > 0,
                      },
                      {
                        label: "Kiểm tra giá bán",
                        text: "Đảm bảo giá phù hợp và chính xác.",
                        done:
                          price.trim() !== "" &&
                          Number.isSafeInteger(basePrice) &&
                          basePrice >= 0 &&
                          basePrice <= 10000000,
                      },
                    ].map((tip) => (
                      <div className={styles.tip} key={tip.label}>
                        <span data-done={tip.done}>
                          {tip.done && <Check size={16} />}
                        </span>
                        <div>
                          <strong>{tip.label}</strong>
                          <small>{tip.text}</small>
                        </div>
                      </div>
                    ))}
                  </section>
                  <div className={styles.bottomActions}>
                    <button
                      type="button"
                      className={styles.outline}
                      onClick={cancel}
                    >
                      Hủy
                    </button>
                    {saveButton}
                  </div>
                  <p className={styles.demo}>
                    Demo frontend · Chưa ghi DB. Các thay đổi mất khi tải lại
                    trang.
                  </p>
                </aside>
              </div>
            </form>
          </div>

          {/* Phiên bản Mobile trùng khớp 100% với ảnh mẫu */}
          <div
            className={styles.mobileView}
            data-testid="seller-menu-create-mobile"
          >
            <header className={styles.mobileTopBar}>
              <button
                type="button"
                className={styles.mobileBackBtn}
                onClick={cancelMobile}
                aria-label="Quay lại Menu"
              >
                <ArrowLeft size={22} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <h1 className={styles.mobileTopTitle}>
                {original ? "Chỉnh sửa món" : "Thêm món mới"}
              </h1>
              <button
                type="button"
                className={styles.mobilePreviewBtn}
                onClick={() => setShowMobilePreview(true)}
                data-testid="seller-menu-create-preview-trigger"
              >
                <Eye size={18} strokeWidth={2.1} aria-hidden="true" />
                <span>Xem trước</span>
              </button>
            </header>

            <form
              onSubmit={saveMobile}
              className={styles.mobileForm}
              noValidate
              data-testid="seller-menu-create-mobile-form"
            >
              {error && (
                <div className={styles.mobileError} role="alert">
                  <span>{error}</span>
                  <button
                    type="button"
                    aria-label="Đóng thông báo lỗi"
                    onClick={() => setError("")}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Card 1: Thông tin cơ bản */}
              <section
                className={styles.mobileCard}
                aria-labelledby="mobile-basic-info-heading"
              >
                <h2
                  id="mobile-basic-info-heading"
                  className={styles.mobileCardTitle}
                >
                  Thông tin cơ bản
                </h2>

                <div className={styles.mobileFieldStack}>
                  <div className={styles.mobileField}>
                    <span className={styles.mobileFieldLabelText}>
                      Ảnh món <b>*</b>
                    </span>
                    <div className={styles.mobilePhotoRow}>
                      <div className={styles.mobilePhotoThumb}>
                        <Image
                          src={mobileImage}
                          alt={mobileName || "Trà sữa truyền thống"}
                          width={94}
                          height={96}
                          unoptimized
                          className={styles.mobilePhotoImg}
                        />
                      </div>
                      <div className={styles.mobilePhotoRight}>
                        <button
                          type="button"
                          className={styles.mobileChangePhotoBtn}
                          onClick={() => mobileUpload.current?.click()}
                        >
                          <PhotoUploadSvgIcon size={19} />
                          <span>
                            {readingImage ? "Đang tải…" : "Đổi ảnh"}
                          </span>
                        </button>
                        <input
                          ref={mobileUpload}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          hidden
                          onChange={(event) => {
                            void readImage(event.target.files?.[0], "mobile");
                            event.target.value = "";
                          }}
                        />
                        <span className={styles.mobilePhotoHint}>
                          JPG, PNG · Tối đa 5MB
                        </span>
                      </div>
                    </div>
                  </div>

                  <label className={styles.mobileField}>
                    <span className={styles.mobileFieldLabelText}>
                      Tên món <b>*</b>
                    </span>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      placeholder="Trà sữa truyền thống"
                      value={mobileName}
                      onChange={(event) => setMobileName(event.target.value)}
                      className={styles.mobileInput}
                    />
                  </label>

                  <div className={styles.mobileTwoCols}>
                    <label className={styles.mobileField}>
                      <span className={styles.mobileFieldLabelText}>
                        Giá bán <b>*</b>
                      </span>
                      <div className={styles.mobilePriceBox}>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          placeholder="20.000"
                          aria-label="Giá bán"
                          value={formatSellerMobilePriceInput(mobilePrice)}
                          onChange={(event) =>
                            setMobilePrice(
                              parseSellerMobilePriceInput(event.target.value),
                            )
                          }
                          className={styles.mobilePriceField}
                        />
                        <span className={styles.mobilePriceSuffix}>đ</span>
                      </div>
                    </label>

                    <label className={styles.mobileField}>
                      <span className={styles.mobileFieldLabelText}>
                        Danh mục <b>*</b>
                      </span>
                      <div className={styles.mobileCategoryBox}>
                        <span
                          className={styles.mobileCategoryIconWrap}
                          aria-hidden="true"
                        >
                          {mobileCategory === "Đồ uống" ? (
                            <DrinkCategorySvgIcon size={20} />
                          ) : (
                            <CookingPot size={19} />
                          )}
                        </span>
                        <select
                          aria-label="Danh mục"
                          value={mobileCategory}
                          onChange={(event) =>
                            setMobileCategory(event.target.value)
                          }
                          className={styles.mobileCategorySelect}
                        >
                          {categories.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={17}
                          strokeWidth={2.3}
                          className={styles.mobileCategoryChevron}
                          aria-hidden="true"
                        />
                      </div>
                    </label>
                  </div>

                  <label className={styles.mobileField}>
                    <span className={styles.mobileFieldLabelText}>
                      Mô tả ngắn
                    </span>
                    <textarea
                      maxLength={160}
                      rows={3}
                      placeholder="Trà sữa thơm béo, trân châu đen dai mềm."
                      value={mobileDescription}
                      onChange={(event) =>
                        setMobileDescription(event.target.value)
                      }
                      className={styles.mobileTextarea}
                    />
                  </label>
                </div>
              </section>

              {/* Card 2: Tùy chọn món (Không bắt buộc) */}
              <section
                className={styles.mobileCard}
                aria-labelledby="mobile-option-groups-heading"
              >
                <div className={styles.mobileOptionHeader}>
                  <h2
                    id="mobile-option-groups-heading"
                    className={styles.mobileCardTitle}
                  >
                    Tùy chọn món{" "}
                    <span className={styles.mobileOptionalTag}>
                      (Không bắt buộc)
                    </span>
                  </h2>
                  <p className={styles.mobileCardSubtitle}>
                    Thêm topping, mức đường hoặc mức đá.
                  </p>
                </div>

                <div className={styles.mobileOptionList}>
                  {mobileGroups.map((group) => {
                    const priceBadge =
                      formatSellerMobileOptionGroupPriceBadge(group);
                    return (
                      <button
                        key={group.id}
                        type="button"
                        className={styles.mobileOptionItem}
                        onClick={() =>
                          setEditor({
                            type: "group",
                            group,
                            target: "mobile",
                          })
                        }
                      >
                        <span
                          className={styles.mobileOptionIcon}
                          aria-hidden="true"
                        >
                          {getMobileOptionGroupIcon(group.name)}
                        </span>
                        <span className={styles.mobileOptionCopy}>
                          <strong>{group.name}</strong>
                          <small>
                            {formatSellerMobileOptionGroupSubtitle(group)}
                          </small>
                        </span>
                        {priceBadge && (
                          <span className={styles.mobileOptionPricePill}>
                            {priceBadge}
                          </span>
                        )}
                        <ChevronRight
                          size={18}
                          strokeWidth={2.1}
                          className={styles.mobileOptionArrow}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className={styles.mobileAddGroupBtn}
                  onClick={() =>
                    setEditor({ type: "group", target: "mobile" })
                  }
                >
                  <Plus size={19} strokeWidth={2.3} aria-hidden="true" />
                  <span>Thêm nhóm tùy chọn</span>
                </button>
              </section>

              {/* Card 3: Hiển thị & tình trạng bán */}
              <section
                className={styles.mobileCard}
                aria-labelledby="mobile-display-status-heading"
                data-testid="seller-menu-create-display-section"
              >
                <h2
                  id="mobile-display-status-heading"
                  className={styles.mobileCardTitle}
                >
                  Hiển thị &amp; tình trạng bán
                </h2>

                <div className={styles.mobileDisplayList}>
                  <div className={styles.mobileDisplayRow}>
                    <span
                      className={styles.mobileDisplayIcon}
                      aria-hidden="true"
                    >
                      <MenuVisibilitySvgIcon size={22} />
                    </span>
                    <div className={styles.mobileDisplayCopy}>
                      <strong>Hiển thị trên thực đơn</strong>
                      <span>Khách có thể nhìn thấy món.</span>
                    </div>
                    <label className={styles.mobileToggle}>
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label="Hiển thị trên thực đơn"
                        checked={mobileActive}
                        onChange={(event) =>
                          setMobileActive(event.target.checked)
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.mobileDisplayRow}>
                    <span
                      className={styles.mobileDisplayIcon}
                      aria-hidden="true"
                    >
                      <SellingStatusSvgIcon size={22} />
                    </span>
                    <div className={styles.mobileDisplayCopy}>
                      <strong>Tình trạng bán</strong>
                    </div>
                    <label
                      className={styles.mobileSellingSelectBox}
                      data-status={mobileSellingStatus}
                    >
                      <span
                        className={styles.mobileSellingDot}
                        aria-hidden="true"
                      />
                      <select
                        aria-label="Tình trạng bán"
                        value={mobileSellingStatus}
                        onChange={(event) => {
                          const next = applySellerMobileSellingStatus(
                            event.target.value as SellerMobileSellingStatus,
                          );
                          setMobileActive(next.active);
                          setMobileOutOfStock(next.outOfStock);
                        }}
                        className={styles.mobileSellingSelect}
                      >
                        <option value="selling">Đang bán</option>
                        <option value="unavailable">Tạm hết</option>
                        <option value="hidden">Đang ẩn</option>
                      </select>
                      <span
                        className={styles.mobileSellingChevronWrap}
                        aria-hidden="true"
                      >
                        <ChevronDown size={16} strokeWidth={2.3} />
                      </span>
                    </label>
                  </div>

                  <div className={styles.mobileDisplayRow}>
                    <span
                      className={styles.mobileDisplayIcon}
                      aria-hidden="true"
                    >
                      <FeaturedDishSvgIcon size={22} />
                    </span>
                    <div className={styles.mobileDisplayCopy}>
                      <strong>Món nổi bật</strong>
                      <span>Ưu tiên trong danh sách món.</span>
                    </div>
                    <label className={styles.mobileToggle}>
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label="Món nổi bật"
                        checked={mobileFeatured}
                        onChange={(event) =>
                          setMobileFeatured(event.target.checked)
                        }
                      />
                    </label>
                  </div>
                </div>
              </section>

              {/* Thanh nút hành động cố định dưới cùng: Hủy | Lưu món */}
              <footer
                className={styles.mobileBottomBar}
                data-testid="seller-menu-create-mobile-actions"
              >
                <div className={styles.mobileBottomInner}>
                  <button
                    type="button"
                    className={styles.mobileCancelBtn}
                    onClick={cancelMobile}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className={styles.mobileSaveBtn}
                    disabled={saving || readingImage}
                  >
                    <SaveDishSvgIcon size={19} />
                    <span>{saving ? "Đang lưu…" : "Lưu món"}</span>
                  </button>
                </div>
              </footer>
            </form>

            {/* Modal Xem trước với sinh viên trên Mobile */}
            {showMobilePreview && (
              <div
                className={styles.mobileModalBackdrop}
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-dish-preview-title"
                onClick={() => setShowMobilePreview(false)}
              >
                <div
                  className={styles.mobileModalCard}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className={styles.mobileModalHeader}>
                    <h3 id="mobile-dish-preview-title">
                      Xem trước với sinh viên
                    </h3>
                    <button
                      type="button"
                      aria-label="Đóng xem trước"
                      onClick={() => setShowMobilePreview(false)}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className={styles.preview}>
                    <div className={styles.previewImage}>
                      <Image
                        src={mobileImage}
                        width={100}
                        height={130}
                        alt={mobileName || "Ảnh món"}
                        unoptimized
                      />
                    </div>
                    <div className={styles.previewCopy}>
                      <div>
                        <h3>{mobileName.trim() || "Tên món của bạn"}</h3>
                        <strong className={styles.money}>
                          {formatMoney(mobileBasePrice)}
                        </strong>
                      </div>
                      <p>
                        <Settings2 size={16} />
                        {mobileGroups.length
                          ? `Có ${mobileGroups.length} nhóm tùy chọn`
                          : "Không có tùy chọn"}
                      </p>
                      <p>
                        <Store size={16} />
                        {shopName}
                      </p>
                      <footer>
                        <span
                          className={styles.badge}
                          data-selling={mobileActive && !mobileOutOfStock}
                        >
                          ● {mobileStatusLabel}
                        </span>
                      </footer>
                    </div>
                  </div>
                  {mobileDescription && (
                    <p className={styles.previewDescription}>
                      {mobileDescription}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
        {editor && (
          <OptionEditor
            key={
              editor.type === "group"
                ? (editor.group?.id ?? "new-group")
                : (editor.option?.id ?? `new-${editor.groupId}`)
            }
            editor={editor}
            onClose={() => setEditor(null)}
            onSave={saveEditor}
          />
        )}
      </div>
    </div>
  );
}
