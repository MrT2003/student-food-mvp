"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, Clock3, Copy, CookingPot, CupSoda, EyeOff, Folder, Headphones, Lightbulb, Pencil, Plus, Search, Settings2, Trash2 } from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import { useSellerPreview } from "@/store/useSellerPreviewStore";
import { demoSellerRestaurant } from "@/lib/mocks/seller-orders.mock";
import { filterSellerMenu, menuCategories, menuStatus, type MenuTab, type SellerMenuRow } from "@/lib/seller/menu";
import { useSellerMenuStore } from "@/store/useSellerMenuStore";
import { formatMoney } from "@/lib/format";
import styles from "@/styles/seller-menu-list.module.css";

const tabs: { id: MenuTab; label: string }[] = [
  { id: "all", label: "Tất cả" }, { id: "selling", label: "Đang bán" },
  { id: "unavailable", label: "Tạm hết" }, { id: "hidden", label: "Đang ẩn" },
];

export default function SellerMenuView() {
  const draft = useSellerPreview();
  const rows = useSellerMenuStore((state) => state.rows);
  const setRows = useSellerMenuStore((state) => state.setRows);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tab, setTab] = useState<MenuTab>("all");
  const [sort, setSort] = useState("updated");
  const [pagination, setPagination] = useState({ filter: "", page: 1 });
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<SellerMenuRow | null>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (deleting) deleteDialog.current?.showModal(); }, [deleting]);
  const categories = [...new Set([...menuCategories, ...rows.map(({ item }) => item.category).filter((name): name is string => Boolean(name))])];
  const visible = filterSellerMenu(rows, query, category, tab, sort);
  const filterKey = JSON.stringify([query, category, tab, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 5));
  const page = Math.min(pagination.filter === filterKey ? pagination.page : 1, pageCount);
  const pageRows = visible.slice((page - 1) * 5, page * 5);
  function goToPage(next: number) {
    setPagination({ filter: filterKey, page: next });
  }
  const stats = [
    { label: "Tổng món", value: rows.length, icon: ClipboardList, tone: "orange" },
    { label: "Đang bán", value: rows.filter(({ item }) => menuStatus(item) === "selling").length, icon: CheckCircle2, tone: "green" },
    { label: "Tạm hết", value: rows.filter(({ item }) => menuStatus(item) === "unavailable").length, icon: Clock3, tone: "orange" },
    { label: "Đang ẩn", value: rows.filter(({ item }) => menuStatus(item) === "hidden").length, icon: EyeOff, tone: "gray" },
  ];
  function update(id: string, fields: Partial<SellerMenuRow["item"]>) {
    setRows((current) => current.map((row) => row.item.id === id ? { ...row, item: { ...row.item, ...fields, updated_at: new Date().toISOString() } } : row));
    setNotice("Đã cập nhật trạng thái món trong bản demo.");
  }
  function duplicate(row: SellerMenuRow) {
    const id = crypto.randomUUID(), now = new Date().toISOString();
    const optionGroups = row.optionGroups?.map((group) => {
      const groupId = crypto.randomUUID();
      return { ...group, id: groupId, menu_item_id: id, created_at: now, updated_at: now,
        options: group.options.map((option) => ({ ...option, id: crypto.randomUUID(), group_id: groupId, created_at: now, updated_at: now })) };
    });
    setRows((current) => [{ ...row, optionGroups, item: { ...row.item, id, name: `${row.item.name} (bản sao)`, slug: `${row.item.slug}-${id.slice(0, 8)}`, created_at: now, updated_at: now } }, ...current]);
    setNotice("Đã nhân bản món trong bản demo.");
  }
  return <div className={styles.page}>
    <StudentHeader variant="seller" />
    <div className={styles.workspace}>
      <SellerSidebar active="menu" name={draft?.name || demoSellerRestaurant.name} />
      <main className={styles.main}>
        <header className={styles.heading}><h1>Menu</h1><p>Quản lý món ăn, giá bán và trạng thái hiển thị của cửa hàng bạn.</p></header>
        <div className={styles.columns}>
          <div className={styles.content}>
            <div className={styles.toolbar}>
              <label className={styles.search}><Search size={21} /><input aria-label="Tìm món ăn theo tên" placeholder="Tìm món ăn theo tên…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
              <label className={styles.categoryFilter}><Folder size={20} /><select aria-label="Lọc danh mục" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Tất cả danh mục</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
              <Link className={styles.primary} href="/seller/menu/new"><Plus size={21} />Thêm món mới</Link>
            </div>
            <div className={styles.tabs} aria-label="Lọc trạng thái món">{tabs.map((entry) => <button key={entry.id} aria-pressed={tab === entry.id} onClick={() => setTab(entry.id)}>{entry.label}</button>)}</div>
            <div className={styles.stats}>{stats.map(({ label, value, icon: Icon, tone }) => <article key={label}><span className={`${styles.statIcon} ${styles[tone]}`}><Icon size={27} /></span><div><p>{label}</p><strong>{value}</strong></div></article>)}</div>
            <div className={styles.listHeading}><h2>Danh sách món ăn</h2><label><Settings2 size={18} /> Sắp xếp: <select aria-label="Sắp xếp món" value={sort} onChange={(e) => setSort(e.target.value)}><option value="updated">Mới cập nhật</option><option value="name">Tên A–Z</option><option value="price">Giá tăng dần</option></select></label></div>
            <div className={styles.list}>{pageRows.map((row) => {
              const item = row.item, CategoryIcon = item.category === "Đồ uống" ? CupSoda : CookingPot;
              return <article key={item.id} className={styles.row}>
                <div className={styles.food} data-category={item.category}>{item.image_url ? <Image src={item.image_url} alt={item.name} width={112} height={112} unoptimized /> : <div className={styles.thumbnail}><CategoryIcon strokeWidth={1.5} aria-hidden="true" /><span>Chưa có ảnh</span></div>}</div>
                <div className={styles.copy}><h3>{item.name}</h3><p>{item.description || "Chưa có mô tả món ăn."}</p></div>
                <span className={styles.categoryTag}><CategoryIcon size={17} />{item.category}</span>
                <div className={styles.price}><strong>{formatMoney(item.price)}</strong><small><Settings2 size={15} />{row.optionCount ? `Có ${row.optionCount} tùy chọn thêm` : "Không có tùy chọn"}</small></div>
                <label className={styles.status}>Hiển thị<select aria-label={`Hiển thị ${item.name}`} data-tone={item.is_active ? "green" : "red"} value={String(item.is_active)} onChange={(e) => update(item.id, { is_active: e.target.value === "true" })}><option value="true">● Đang hiển thị</option><option value="false">● Đang ẩn</option></select></label>
                <label className={styles.status}>Tình trạng bán<select aria-label={`Tình trạng bán ${item.name}`} data-tone={item.is_available ? "green" : "red"} value={String(item.is_available)} onChange={(e) => update(item.id, { is_available: e.target.value === "true" })}><option value="true">● Đang bán</option><option value="false">● Tạm hết</option></select></label>
                <div className={styles.actions}><Link href={`/seller/menu/${item.id}/edit`}><Pencil size={16} />Chỉnh sửa</Link><button onClick={() => duplicate(row)}><Copy size={16} />Nhân bản</button><button className={styles.delete} onClick={() => setDeleting(row)}><Trash2 size={16} />Xóa</button></div>
              </article>;
            })}{!visible.length && <div className={styles.empty}><CookingPot size={36} /><h3>Không tìm thấy món ăn</h3><p>Thử đổi từ khóa, danh mục hoặc trạng thái.</p><button onClick={() => { setQuery(""); setCategory(""); setTab("all"); }}>Xóa bộ lọc</button></div>}</div>
            {visible.length > 0 && <nav className={styles.pagination} aria-label="Phân trang món ăn"><span>Hiển thị {(page - 1) * 5 + 1}–{Math.min(page * 5, visible.length)} / {visible.length} món</span><div><button disabled={page === 1} onClick={() => goToPage(page - 1)} aria-label="Trang trước">‹</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} aria-label={`Trang ${number}`} aria-current={number === page ? "page" : undefined} onClick={() => goToPage(number)}>{number}</button>)}<button disabled={page === pageCount} onClick={() => goToPage(page + 1)} aria-label="Trang sau">›</button></div></nav>}
            <p className={styles.demo}>Bản xem thử · Thay đổi chưa được lưu sau khi tải lại trang.</p>
            <p className={styles.notice} role="status">{notice}</p>
          </div>
          <aside className={styles.right}>
            <section className={styles.card}><div className={styles.cardHeading}><span><Folder /></span><h2>Danh mục</h2></div><p className={styles.hint}>Chọn danh mục để lọc món ăn</p>{categories.map((name) => <button key={name} className={styles.categoryRow} aria-pressed={category === name} onClick={() => setCategory(category === name ? "" : name)}><span>{name === "Đồ uống" ? <CupSoda /> : <CookingPot />}</span><strong>{name}</strong><small>{rows.filter(({ item }) => item.category === name).length} món</small></button>)}</section>
            <section className={styles.card}><div className={styles.cardHeading}><span><Lightbulb /></span><h2>Gợi ý quản lý menu</h2></div>{[
              ["Thêm ảnh món ăn", "Món ăn có hình ảnh sẽ thu hút sinh viên hơn."],
              ["Thiết lập tùy chọn thêm", "Cho phép khách chọn size, topping để tăng doanh thu."],
              ["Kiểm tra trạng thái món", "Đảm bảo các món luôn hiển thị đúng trạng thái."],
            ].map(([title, text]) => <label className={styles.tip} key={title}><input type="checkbox" /><span><strong>{title}</strong><small>{text}</small></span></label>)}</section>
            <section className={styles.card}><div className={styles.cardHeading}><span><Lightbulb /></span><h2>Cần hỗ trợ?</h2></div><p className={styles.support}>Nếu bạn có thắc mắc trong quá trình quản lý menu, hãy xem hướng dẫn hoặc liên hệ đội ngũ StudentFood.</p><button className={styles.outline} onClick={() => setNotice("Hướng dẫn: Thêm món, nhập tên/giá/danh mục, rồi dùng hai bộ chọn để đổi hiển thị và tình trạng bán.")}>Xem hướng dẫn <ArrowRight size={18} /></button><button className={styles.contact} onClick={() => setNotice("Kênh hỗ trợ chưa được cấu hình trong bản demo.")}><Headphones size={20} />Liên hệ hỗ trợ</button></section>
          </aside>
        </div>
      </main>
    </div>
    {deleting && <dialog ref={deleteDialog} className={styles.dialog} onClose={() => setDeleting(null)} aria-labelledby="delete-menu-title"><h2 id="delete-menu-title">Xóa món ăn?</h2><p>Bạn có muốn xóa “{deleting.item.name}” khỏi bản demo?</p><footer><button onClick={() => setDeleting(null)}>Hủy</button><button className={styles.primary} onClick={() => { setRows((current) => current.filter((row) => row.item.id !== deleting.item.id)); setDeleting(null); setNotice("Đã xóa món trong bản demo."); }}>Xóa món</button></footer></dialog>}
  </div>;
}
