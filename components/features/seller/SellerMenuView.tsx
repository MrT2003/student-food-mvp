"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Copy,
  CookingPot,
  CupSoda,
  Eye,
  EyeOff,
  Folder,
  Headphones,
  Lightbulb,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import { useSellerAccess } from "./SellerAccessProvider";

import {
  filterSellerMenu,
  menuCategories,
  menuStatus,
  type MenuTab,
  type SellerMenuRow,
} from "@/lib/seller/menu";
import { useSellerMenuStore } from "@/store/useSellerMenuStore";
import { formatMoney } from "@/lib/format";
import type { MenuItem } from "@/types/restaurant.types";
import styles from "@/styles/seller-menu-list.module.css";

const tabs: { id: MenuTab; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "selling", label: "Đang bán" },
  { id: "unavailable", label: "Tạm hết" },
  { id: "hidden", label: "Đang ẩn" },
];

export const sellerMobileMenuTabs: readonly {
  id: MenuTab;
  label: string;
}[] = [
  { id: "all", label: "Tất cả" },
  { id: "selling", label: "Đang bán" },
  { id: "unavailable", label: "Tạm hết" },
  { id: "hidden", label: "Đang ẩn" },
] as const;

export const sellerMobileMenuSortOptions = [
  { value: "updated", label: "Mới cập nhật" },
  { value: "name", label: "Tên A–Z" },
  { value: "price", label: "Giá tăng dần" },
] as const;

export function getSellerMobileMenuItemImage(item: MenuItem): string | null { return item.image_url ?? null; }

export function formatSellerMobileMenuSubtitle(
  category: string | null | undefined,
  optionCount: number,
): string {
  const categoryLabel = category?.trim() || "Khác";
  const optionLabel =
    optionCount > 0 ? `${optionCount} tùy chọn` : "Không có tùy chọn";
  return `${categoryLabel} • ${optionLabel}`;
}

export function getSellerMobileMenuTabCounts(
  rows: SellerMenuRow[],
  query = "",
  category = "",
): Record<MenuTab, number> {
  const baseRows = filterSellerMenu(rows, query, category, "all", "updated");
  return {
    all: baseRows.length,
    selling: baseRows.filter(({ item }) => menuStatus(item) === "selling")
      .length,
    unavailable: baseRows.filter(
      ({ item }) => menuStatus(item) === "unavailable",
    ).length,
    hidden: baseRows.filter(({ item }) => menuStatus(item) === "hidden").length,
  };
}

export function filterAndSortSellerMobileMenu(
  rows: SellerMenuRow[],
  options: {
    query?: string;
    category?: string;
    tab?: MenuTab;
    sort?: string;
  } = {},
): SellerMenuRow[] {
  const query = options.query ?? "";
  const category = options.category ?? "";
  const tab = options.tab ?? "all";
  const sort = options.sort ?? "updated";
  const filtered = filterSellerMenu(rows, query, category, tab, sort);

  if (sort !== "updated") {
    return filtered;
  }

  return filtered;
}

export function applySellerMobileMenuStatusChange(
  status: Exclude<MenuTab, "all">,
): Partial<Pick<MenuItem, "is_active" | "is_available">> {
  if (status === "selling") {
    return { is_available: true };
  }
  if (status === "unavailable") {
    return { is_available: false };
  }
  return { is_active: false };
}

export default function SellerMenuView() {
  const { data } = useSellerAccess();
  if (!data?.restaurant || data.user.role !== "seller") return <p role="alert">Chỉ chủ quán được quản lý thực đơn.</p>;
  return <SellerMenuContent key={`${data.user.id}:${data.restaurant.id}`} />;
}
function SellerMenuContent() {
  const { data } = useSellerAccess();

  const restaurantId = data?.restaurant?.id;
  const shopName = data?.restaurant?.name ?? "";

  const cachedRows = useSellerMenuStore((state) => state.rows);
  const loadedId = useSellerMenuStore(state => state.restaurantId);
  const rows = loadedId === restaurantId ? cachedRows : [];
  const menuLoading = useSellerMenuStore(state => state.loading);
  const menuError = useSellerMenuStore(state => state.error);
  const busy = useSellerMenuStore(state => state.busy);
  const loadRestaurantMenu = useSellerMenuStore(
    (state) => state.loadRestaurantMenu,
  );
  const saveMenuItem = useSellerMenuStore((state) => state.saveMenuItem);
  const updateMenuItemFields = useSellerMenuStore(
    (state) => state.updateMenuItemFields,
  );
  const deleteMenuItem = useSellerMenuStore((state) => state.deleteMenuItem);

  useEffect(() => {
    if (restaurantId) {
      void loadRestaurantMenu(restaurantId);
    }
  }, [restaurantId, loadRestaurantMenu]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tab, setTab] = useState<MenuTab>("all");
  const [sort, setSort] = useState("updated");
  const [pagination, setPagination] = useState({ filter: "", page: 1 });
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<SellerMenuRow | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (deleting) deleteDialog.current?.showModal();
  }, [deleting]);
  const categories = [
    ...new Set([
      ...menuCategories,
      ...rows
        .map(({ item }) => item.category)
        .filter((name): name is string => Boolean(name)),
    ]),
  ];
  const visible = filterSellerMenu(rows, query, category, tab, sort);
  const filterKey = JSON.stringify([query, category, tab, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 5));
  const page = Math.min(
    pagination.filter === filterKey ? pagination.page : 1,
    pageCount,
  );
  const pageRows = visible.slice((page - 1) * 5, page * 5);
  function goToPage(next: number) {
    setPagination({ filter: filterKey, page: next });
  }
  const stats = [
    {
      label: "Tổng món",
      value: rows.length,
      icon: ClipboardList,
      tone: "orange",
    },
    {
      label: "Đang bán",
      value: rows.filter(({ item }) => menuStatus(item) === "selling").length,
      icon: CheckCircle2,
      tone: "green",
    },
    {
      label: "Tạm hết",
      value: rows.filter(({ item }) => menuStatus(item) === "unavailable")
        .length,
      icon: Clock3,
      tone: "orange",
    },
    {
      label: "Đang ẩn",
      value: rows.filter(({ item }) => menuStatus(item) === "hidden").length,
      icon: EyeOff,
      tone: "gray",
    },
  ];
  async function update(id: string, fields: Partial<SellerMenuRow["item"]>) {
    try { await updateMenuItemFields(id, fields); setNotice("Đã cập nhật trạng thái món."); } catch (e) { setNotice(e instanceof Error ? e.message : "Không lưu được trạng thái."); }
  }
  async function duplicate(row: SellerMenuRow) {
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    const optionGroups = row.optionGroups?.map((group) => {
      const groupId = crypto.randomUUID();
      return {
        ...group,
        id: groupId,
        menu_item_id: id,
        created_at: now,
        updated_at: now,
        options: group.options.map((option) => ({
          ...option,
          id: crypto.randomUUID(),
          group_id: groupId,
          created_at: now,
          updated_at: now,
        })),
      };
    });
    const newRow: SellerMenuRow = {
      ...row,
      optionGroups,
      item: {
        ...row.item,
        id,
        restaurant_id: restaurantId ?? row.item.restaurant_id,
        name: `${row.item.name} (bản sao)`,
        slug: `${row.item.slug}-${id.slice(0, 8)}`,
        created_at: now,
        updated_at: now,
      },
    };
    try { await saveMenuItem(newRow, false); setNotice("Đã nhân bản món."); } catch(e) {setNotice(e instanceof Error ? e.message : "Không nhân bản được món.");}
  }

  const mobileTabCounts = getSellerMobileMenuTabCounts(rows, query, category);
  const mobileVisible = filterAndSortSellerMobileMenu(rows, {
    query,
    category,
    tab,
    sort,
  });

  return (
    <div className={styles.page}>
      <StudentHeader variant="seller" />
      <div className={styles.workspace}>
        <SellerSidebar
          active="menu"
          name={shopName}
          menuLabel="Thực đơn"
        />
        <main className={styles.main}>
          {menuLoading && <p role="status">Đang tải thực đơn…</p>}
          {menuError && <p role="alert">{menuError}<button onClick={() => restaurantId && void loadRestaurantMenu(restaurantId)}>Thử lại</button></p>}
          <fieldset disabled={busy || menuLoading || !!menuError} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          {/* Phiên bản Desktop giữ nguyên 100% */}
          <div className={styles.desktopView}>
            <header className={styles.heading}>
              <h1>Menu</h1>
              <p>
                Quản lý món ăn, giá bán và trạng thái hiển thị của cửa hàng bạn.
              </p>
            </header>
            <div className={styles.columns}>
              <div className={styles.content}>
                <div className={styles.toolbar}>
                  <label className={styles.search}>
                    <Search size={21} />
                    <input
                      aria-label="Tìm món ăn theo tên"
                      placeholder="Tìm món ăn theo tên…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label className={styles.categoryFilter}>
                    <Folder size={20} />
                    <select
                      aria-label="Lọc danh mục"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">Tất cả danh mục</option>
                      {categories.map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                  <Link className={styles.primary} href="/seller/menu/new">
                    <Plus size={21} />
                    Thêm món mới
                  </Link>
                </div>
                <div className={styles.tabs} aria-label="Lọc trạng thái món">
                  {tabs.map((entry) => (
                    <button
                      key={entry.id}
                      aria-pressed={tab === entry.id}
                      onClick={() => setTab(entry.id)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
                <div className={styles.stats}>
                  {stats.map(({ label, value, icon: Icon, tone }) => (
                    <article key={label}>
                      <span className={`${styles.statIcon} ${styles[tone]}`}>
                        <Icon size={27} />
                      </span>
                      <div>
                        <p>{label}</p>
                        <strong>{value}</strong>
                      </div>
                    </article>
                  ))}
                </div>
                <div className={styles.listHeading}>
                  <h2>Danh sách món ăn</h2>
                  <label>
                    <Settings2 size={18} /> Sắp xếp:{" "}
                    <select
                      aria-label="Sắp xếp món"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="updated">Mới cập nhật</option>
                      <option value="name">Tên A–Z</option>
                      <option value="price">Giá tăng dần</option>
                    </select>
                  </label>
                </div>
                <div className={styles.list}>
                  {pageRows.map((row) => {
                    const item = row.item,
                      CategoryIcon =
                        item.category === "Đồ uống" ? CupSoda : CookingPot;
                    return (
                      <article key={item.id} className={styles.row}>
                        <div
                          className={styles.food}
                          data-category={item.category}
                        >
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.name}
                              width={112}
                              height={112}
                              unoptimized
                            />
                          ) : (
                            <div className={styles.thumbnail}>
                              <CategoryIcon
                                strokeWidth={1.5}
                                aria-hidden="true"
                              />
                              <span>Chưa có ảnh</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.copy}>
                          <h3>{item.name}</h3>
                          <p>{item.description || "Chưa có mô tả món ăn."}</p>
                        </div>
                        <span className={styles.categoryTag}>
                          <CategoryIcon size={17} />
                          {item.category}
                        </span>
                        <div className={styles.price}>
                          <strong>{formatMoney(item.price)}</strong>
                          <small>
                            <Settings2 size={15} />
                            {row.optionCount
                              ? `Có ${row.optionCount} tùy chọn thêm`
                              : "Không có tùy chọn"}
                          </small>
                        </div>
                        <label className={styles.status}>
                          Hiển thị
                          <select
                            aria-label={`Hiển thị ${item.name}`}
                            data-tone={item.is_active ? "green" : "red"}
                            value={String(item.is_active)}
                            onChange={(e) =>
                              update(item.id, {
                                is_active: e.target.value === "true",
                              })
                            }
                          >
                            <option value="true">● Đang hiển thị</option>
                            <option value="false">● Đang ẩn</option>
                          </select>
                        </label>
                        <label className={styles.status}>
                          Tình trạng bán
                          <select
                            aria-label={`Tình trạng bán ${item.name}`}
                            data-tone={item.is_available ? "green" : "red"}
                            value={String(item.is_available)}
                            onChange={(e) =>
                              update(item.id, {
                                is_available: e.target.value === "true",
                              })
                            }
                          >
                            <option value="true">● Đang bán</option>
                            <option value="false">● Tạm hết</option>
                          </select>
                        </label>
                        <div className={styles.actions}>
                          <Link href={`/seller/menu/${item.id}/edit`}>
                            <Pencil size={16} />
                            Chỉnh sửa
                          </Link>
                          <button onClick={() => duplicate(row)}>
                            <Copy size={16} />
                            Nhân bản
                          </button>
                          <button
                            className={styles.delete}
                            onClick={() => setDeleting(row)}
                          >
                            <Trash2 size={16} />
                            Ẩn món
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {!menuLoading && !menuError && !visible.length && (
                    <div className={styles.empty}>
                      <CookingPot size={36} />
                      <h3>Không tìm thấy món ăn</h3>
                      <p>
                        {rows.length === 0
                          ? "Cửa hàng của bạn chưa có món ăn nào. Hãy bấm “Thêm món mới” để bắt đầu."
                          : "Thử đổi từ khóa, danh mục hoặc trạng thái."}
                      </p>
                      {rows.length > 0 && (
                        <button
                          onClick={() => {
                            setQuery("");
                            setCategory("");
                            setTab("all");
                          }}
                        >
                          Xóa bộ lọc
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {visible.length > 0 && (
                  <nav
                    className={styles.pagination}
                    aria-label="Phân trang món ăn"
                  >
                    <span>
                      Hiển thị {(page - 1) * 5 + 1}–
                      {Math.min(page * 5, visible.length)} / {visible.length}{" "}
                      món
                    </span>
                    <div>
                      <button
                        disabled={page === 1}
                        onClick={() => goToPage(page - 1)}
                        aria-label="Trang trước"
                      >
                        ‹
                      </button>
                      {Array.from(
                        { length: pageCount },
                        (_, index) => index + 1,
                      ).map((number) => (
                        <button
                          key={number}
                          aria-label={`Trang ${number}`}
                          aria-current={number === page ? "page" : undefined}
                          onClick={() => goToPage(number)}
                        >
                          {number}
                        </button>
                      ))}
                      <button
                        disabled={page === pageCount}
                        onClick={() => goToPage(page + 1)}
                        aria-label="Trang sau"
                      >
                        ›
                      </button>
                    </div>
                  </nav>
                )}
                <p className={styles.notice} role="status">
                  {notice}
                </p>
              </div>
              <aside className={styles.right}>
                <section className={styles.card}>
                  <div className={styles.cardHeading}>
                    <span>
                      <Folder />
                    </span>
                    <h2>Danh mục</h2>
                  </div>
                  <p className={styles.hint}>Chọn danh mục để lọc món ăn</p>
                  {categories.map((name) => (
                    <button
                      key={name}
                      className={styles.categoryRow}
                      aria-pressed={category === name}
                      onClick={() =>
                        setCategory(category === name ? "" : name)
                      }
                    >
                      <span>
                        {name === "Đồ uống" ? <CupSoda /> : <CookingPot />}
                      </span>
                      <strong>{name}</strong>
                      <small>
                        {
                          rows.filter(({ item }) => item.category === name)
                            .length
                        }{" "}
                        món
                      </small>
                    </button>
                  ))}
                </section>
                <section className={styles.card}>
                  <div className={styles.cardHeading}>
                    <span>
                      <Lightbulb />
                    </span>
                    <h2>Gợi ý quản lý menu</h2>
                  </div>
                  {[
                    [
                      "Thêm ảnh món ăn",
                      "Món ăn có hình ảnh sẽ thu hút sinh viên hơn.",
                    ],
                    [
                      "Thiết lập tùy chọn thêm",
                      "Cho phép khách chọn size, topping để tăng doanh thu.",
                    ],
                    [
                      "Kiểm tra trạng thái món",
                      "Đảm bảo các món luôn hiển thị đúng trạng thái.",
                    ],
                  ].map(([title, text]) => (
                    <label className={styles.tip} key={title}>
                      <input type="checkbox" />
                      <span>
                        <strong>{title}</strong>
                        <small>{text}</small>
                      </span>
                    </label>
                  ))}
                </section>
                <section className={styles.card}>
                  <div className={styles.cardHeading}>
                    <span>
                      <Lightbulb />
                    </span>
                    <h2>Cần hỗ trợ?</h2>
                  </div>
                  <p className={styles.support}>
                    Nếu bạn có thắc mắc trong quá trình quản lý menu, hãy xem
                    hướng dẫn hoặc liên hệ đội ngũ StudentFood.
                  </p>
                  <button
                    className={styles.outline}
                    onClick={() =>
                      setNotice(
                        "Hướng dẫn: Thêm món, nhập tên/giá/danh mục, rồi dùng hai bộ chọn để đổi hiển thị và tình trạng bán.",
                      )
                    }
                  >
                    Xem hướng dẫn <ArrowRight size={18} />
                  </button>
                  <button
                    className={styles.contact}
                    onClick={() =>
                      setNotice("Kênh hỗ trợ chưa được cấu hình.")
                    }
                  >
                    <Headphones size={20} />
                    Liên hệ hỗ trợ
                  </button>
                </section>
              </aside>
            </div>
          </div>

          {/* Phiên bản Mobile trùng khớp 100% với ảnh mẫu */}
          <div className={styles.mobileView} data-testid="seller-menu-mobile">
            <header className={styles.mobileHeaderRow}>
              <div className={styles.mobileHeadingText}>
                <h1>Thực đơn</h1>
                <p>Quản lý món ăn và trạng thái bán.</p>
              </div>
              <Link
                href="/seller/menu/new"
                className={styles.mobileAddButton}
                aria-label="Thêm món"
              >
                <Plus size={19} strokeWidth={2.5} aria-hidden="true" />
                <span>Thêm món</span>
              </Link>
            </header>

            <label className={styles.mobileSearch}>
              <Search size={19} strokeWidth={2.1} aria-hidden="true" />
              <input
                type="search"
                aria-label="Tìm tên món ăn"
                placeholder="Tìm tên món ăn"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            <div className={styles.mobileCategoryRow}>
              <label className={styles.mobileCategoryPill}>
                <select
                  aria-label="Lọc theo danh mục"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Danh mục: Tất cả</option>
                  {categories.map((name) => (
                    <option key={name} value={name}>
                      Danh mục: {name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  strokeWidth={2.3}
                  className={styles.mobileCategoryChevron}
                  aria-hidden="true"
                />
              </label>

              <button
                type="button"
                className={styles.mobileManageCategoryBtn}
                onClick={() => setManagingCategories((prev) => !prev)}
                aria-expanded={managingCategories}
              >
                Quản lý danh mục
              </button>
            </div>

            {managingCategories && (
              <section
                className={styles.mobileCategorySheet}
                aria-label="Quản lý danh mục món ăn"
              >
                <div className={styles.mobileCategorySheetHeader}>
                  <strong>Danh mục món ăn</strong>
                  <button
                    type="button"
                    onClick={() => setManagingCategories(false)}
                    aria-label="Đóng quản lý danh mục"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className={styles.mobileCategoryChips}>
                  <button
                    type="button"
                    aria-pressed={category === ""}
                    onClick={() => setCategory("")}
                  >
                    Tất cả ({rows.length})
                  </button>
                  {categories.map((name) => (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={category === name}
                      onClick={() =>
                        setCategory(category === name ? "" : name)
                      }
                    >
                      {name} (
                      {rows.filter(({ item }) => item.category === name).length})
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div
              className={styles.mobileTabs}
              aria-label="Trạng thái món ăn"
            >
              {sellerMobileMenuTabs.map((entry) => {
                const isActive = tab === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={isActive}
                    className={`${styles.mobileTabButton} ${
                      isActive ? styles.mobileTabActive : ""
                    }`}
                    onClick={() => setTab(entry.id)}
                  >
                    <span className={styles.mobileTabLabel}>{entry.label}</span>
                    <strong className={styles.mobileTabCount}>
                      {mobileTabCounts[entry.id]}
                    </strong>
                  </button>
                );
              })}
            </div>

            <div className={styles.mobileSummaryRow}>
              <span className={styles.mobileDishCount}>
                {mobileVisible.length} món
              </span>
              <label className={styles.mobileSortSelect}>
                <select
                  aria-label="Sắp xếp thực đơn"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  {sellerMobileMenuSortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
              </label>
            </div>

            {notice && (
              <p role="status" className={styles.mobileNotice}>
                <span>{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice("")}
                  aria-label="Đóng thông báo"
                >
                  <X size={15} />
                </button>
              </p>
            )}

            <div className={styles.mobileCardList}>
              {mobileVisible.map((row) => {
                const { item } = row;
                const status = menuStatus(item);
                const imageSrc = getSellerMobileMenuItemImage(item);
                const CategoryIcon =
                  item.category === "Đồ uống" ? CupSoda : CookingPot;
                const isMenuOpen = openMenuId === item.id;
                const useSlashedEye =
                  !item.is_active;

                return (
                  <article key={item.id} className={styles.mobileCard}>
                    <div className={styles.mobileCardTop}>
                      <div
                        className={styles.mobileFoodThumb}
                        data-category={item.category}
                      >
                        {imageSrc ? (
                          <Image
                            src={imageSrc}
                            alt={item.name}
                            width={95}
                            height={81}
                            unoptimized
                            className={styles.mobileFoodImage}
                          />
                        ) : (
                          <div className={styles.mobileFoodFallback}>
                            <CategoryIcon
                              size={32}
                              strokeWidth={1.6}
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </div>

                      <div className={styles.mobileCardBody}>
                        <div className={styles.mobileCardTitleRow}>
                          <h3>{item.name}</h3>
                          <div className={styles.mobileMoreWrap}>
                            <button
                              type="button"
                              className={styles.mobileMoreButton}
                              aria-label={`Tùy chọn cho ${item.name}`}
                              aria-expanded={isMenuOpen}
                              onClick={() =>
                                setOpenMenuId(isMenuOpen ? null : item.id)
                              }
                            >
                              <MoreVertical size={18} aria-hidden="true" />
                            </button>
                            {isMenuOpen && (
                              <div
                                className={styles.mobileActionPopover}
                                role="menu"
                              >
                                <Link
                                  href={`/seller/menu/${item.id}/edit`}
                                  role="menuitem"
                                  onClick={() => setOpenMenuId(null)}
                                >
                                  <Pencil size={15} />
                                  Chỉnh sửa
                                </Link>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    duplicate(row);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  <Copy size={15} />
                                  Nhân bản
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={styles.mobileActionDelete}
                                  onClick={() => {
                                    setDeleting(row);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  <Trash2 size={15} />
                                  Ẩn món
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className={styles.mobileCardSubtitle}>
                          {formatSellerMobileMenuSubtitle(
                            item.category,
                            row.optionCount,
                          )}
                        </p>

                        <div className={styles.mobileCardPriceRow}>
                          <strong className={styles.mobileCardPrice}>
                            {formatMoney(item.price)}
                          </strong>
                          {!item.is_active && (
                            <span className={styles.mobileHiddenHint}>
                              Khách chưa thấy món
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={styles.mobileCardBottom}>
                      <button
                        type="button"
                        className={styles.mobileVisibilityToggle}
                        onClick={() =>
                          update(item.id, { is_active: !item.is_active })
                        }
                        aria-label={`Đổi hiển thị ${item.name}`}
                      >
                        {useSlashedEye ? (
                          <EyeOff
                            size={17}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        ) : (
                          <Eye size={17} strokeWidth={2} aria-hidden="true" />
                        )}
                        <span>
                          {item.is_active ? "Đang hiển thị" : "Đang ẩn"}
                        </span>
                      </button>

                      <label
                        className={styles.mobileStatusBadge}
                        data-status={status}
                      >
                        <span
                          className={styles.mobileStatusDot}
                          aria-hidden="true"
                        />
                        <select
                          aria-label={`Trạng thái bán ${item.name}`}
                          value={status}
                          onChange={(e) =>
                            update(
                              item.id,
                              applySellerMobileMenuStatusChange(
                                e.target.value as Exclude<MenuTab, "all">,
                              ),
                            )
                          }
                        >
                          <option value="selling">Đang bán</option>
                          <option value="unavailable">Tạm hết</option>
                          <option value="hidden">Đang ẩn</option>
                        </select>
                        <ChevronDown
                          size={15}
                          strokeWidth={2.4}
                          className={styles.mobileStatusChevron}
                          aria-hidden="true"
                        />
                      </label>
                    </div>
                  </article>
                );
              })}

              {!menuLoading && !menuError && !mobileVisible.length && (
                <div className={styles.mobileEmpty}>
                  <CookingPot size={34} />
                  <h3>Không tìm thấy món ăn</h3>
                  <p>
                    {rows.length === 0
                      ? "Cửa hàng của bạn chưa có món ăn nào. Hãy bấm “Thêm món” để bắt đầu."
                      : "Thử đổi từ khóa, danh mục hoặc trạng thái."}
                  </p>
                  {rows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setCategory("");
                        setTab("all");
                      }}
                    >
                      Xóa bộ lọc
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          </fieldset>
        </main>
      </div>
      {deleting && (
        <dialog
          ref={deleteDialog}
          className={styles.dialog}
          onClose={() => setDeleting(null)}
          aria-labelledby="delete-menu-title"
        >
          <h2 id="delete-menu-title">Ẩn món ăn?</h2>
          <p>Bạn có muốn xóa “{deleting.item.name}” khỏi menu khách hàng? Có thể hiện lại trong tab Đang ẩn.</p>
          <footer>
            <button onClick={() => setDeleting(null)}>Hủy</button>
            <button
              className={styles.primary}
              onClick={async () => { try { await deleteMenuItem(deleting.item.id); setDeleting(null); setNotice("Đã ẩn món; có thể hiện lại."); } catch(e) { setNotice(e instanceof Error ? e.message : "Không ẩn được món."); setDeleting(null); } }}
              disabled={busy}
            >
              Ẩn món
            </button>
          </footer>
        </dialog>
      )}
    </div>
  );
}
