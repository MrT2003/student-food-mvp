"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ClipboardList, Eye, ImagePlus, Lightbulb, Pencil, Plus, Save, Settings2, Store, Tag, Trash2, X } from "lucide-react";
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

type DraftOption = { id: string; option_name: string; additional_price: number };
type DraftGroup = { id: string; name: string; is_multiple: boolean; is_required: boolean; options: DraftOption[] };
type Editor = { type: "group"; group?: DraftGroup } | { type: "option"; groupId: string; option?: DraftOption };

function OptionEditor({ editor, onClose, onSave }: {
  editor: Editor; onClose: () => void;
  onSave: (values: { name: string; multiple: boolean; required: boolean; price: number }) => string | void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const price = Number(data.get("price") ?? 0);
    if (!name || !Number.isSafeInteger(price) || price < 0 || price > 10000000) {
      setError("Nhập tên hợp lệ và giá nguyên từ 0 đến 10.000.000đ."); return;
    }
    const message = onSave({ name, price, multiple: data.get("multiple") === "true", required: data.has("required") });
    if (message) setError(message);
  }
  const group = editor.type === "group" ? editor.group : undefined;
  const option = editor.type === "option" ? editor.option : undefined;
  return <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby="option-editor-title">
    <form onSubmit={submit}>
      <header><h2 id="option-editor-title">{editor.type === "group" ? `${group ? "Sửa" : "Thêm"} nhóm tùy chọn` : `${option ? "Sửa" : "Thêm"} lựa chọn`}</h2><button type="button" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
      <label>Tên {editor.type === "group" ? "nhóm" : "lựa chọn"}<input autoFocus required maxLength={80} name="name" defaultValue={group?.name ?? option?.option_name ?? ""} /></label>
      {editor.type === "group" ? <>
        <label>Kiểu chọn<select name="multiple" defaultValue={String(group?.is_multiple ?? true)}><option value="true">Chọn nhiều</option><option value="false">Chọn một</option></select></label>
        <label className={styles.checkLabel}><input type="checkbox" name="required" defaultChecked={group?.is_required ?? false} />Bắt buộc chọn</label>
      </> : <label>Giá cộng thêm (đ)<input name="price" type="number" min={0} max={10000000} step={1} required defaultValue={option?.additional_price ?? 0} /></label>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <footer><button type="button" className={styles.outline} onClick={onClose}>Hủy</button><button className={styles.primary} type="submit">Lưu</button></footer>
    </form>
  </dialog>;
}

export default function SellerMenuCreateView({ itemId }: { itemId?: string }) {
  const row = useSellerMenuStore((state) => state.rows.find((entry) => entry.item.id === itemId));
  const router = useRouter();
  if (itemId && !row) return <div className={shell.page}><StudentHeader variant="seller" /><main className={shell.workspace}>
    <SellerSidebar active="menu" name={demoSellerRestaurant.name} /><section className={styles.card}>
      <h1>Không tìm thấy món ăn</h1><p>Món có thể đã bị xóa hoặc dữ liệu demo đã mất khi tải lại trang.</p>
      <button className={styles.outline} onClick={() => router.push("/seller/menu")}>Quay lại Menu</button>
    </section>
  </main></div>;
  return <SellerMenuForm key={itemId ?? "new"} original={itemId ? row : undefined} />;
}

function SellerMenuForm({ original }: { original?: SellerMenuRow }) {
  const router = useRouter();
  const seller = useSellerPreview();
  const rows = useSellerMenuStore((state) => state.rows);
  const setRows = useSellerMenuStore((state) => state.setRows);
  const shopName = seller?.name || demoSellerRestaurant.name;
  const categories = [...new Set([...menuCategories, ...rows.map(({ item }) => item.category).filter((value): value is string => Boolean(value))])];
  const [name, setName] = useState(original?.item.name ?? "");
  const [category, setCategory] = useState(original?.item.category ?? "Đồ uống");
  const [price, setPrice] = useState(original ? String(original.item.price) : "");
  const [description, setDescription] = useState(original?.item.description ?? "");
  const [image, setImage] = useState<string | null>(original?.item.image_url ?? null);
  const [readingImage, setReadingImage] = useState(false);
  const [groups, setGroups] = useState<DraftGroup[]>(() => original?.optionGroups?.map((group) => ({
    id: group.id, name: group.name, is_multiple: group.is_multiple, is_required: group.is_required,
    options: group.options.map((option) => ({ id: option.id, option_name: option.option_name, additional_price: option.additional_price })),
  })) ?? []);
  const [groupsChanged, setGroupsChanged] = useState(false);
  const [active, setActive] = useState(original?.item.is_active ?? true);
  const [outOfStock, setOutOfStock] = useState(original ? !original.item.is_available : false);
  const [featured, setFeatured] = useState(original?.featuredPreview ?? false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitted = useRef(false);
  const uploadRequestId = useRef(0);
  const preview = useRef<HTMLElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const initial = useRef(JSON.stringify({ name, category, price, description, image, groups, active, outOfStock, featured }));
  const basePrice = Number(price) || 0;
  const status = !active ? "Đang ẩn" : outOfStock ? "Tạm hết" : "Đang bán";

  async function readImage(file?: File) {
    if (!file) return;
    const requestId = ++uploadRequestId.current;
    setReadingImage(true);
    setError("");
    try {
      const uploaded = await CloudinaryService.uploadImage(file, {
        folder: "student-food/menu-items",
      });
      if (uploadRequestId.current === requestId) {
        setImage(uploaded.secureUrl);
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

  function saveEditor(values: { name: string; multiple: boolean; required: boolean; price: number }): string | void {
    if (!editor) return;
    const sameName = (a: string) => normalizeSearchText(a) === normalizeSearchText(values.name);
    if (editor.type === "group") {
      if (groups.some((group) => group.id !== editor.group?.id && sameName(group.name))) return "Tên nhóm đã tồn tại.";
      const group: DraftGroup = { id: editor.group?.id ?? crypto.randomUUID(), name: values.name,
        is_multiple: values.multiple, is_required: values.required, options: editor.group?.options ?? [] };
      setGroups((current) => editor.group ? current.map((entry) => entry.id === group.id ? group : entry) : [...current, group]);
    } else {
      const group = groups.find((entry) => entry.id === editor.groupId);
      if (!group) return "Nhóm tùy chọn không còn tồn tại.";
      if (group.options.some((option) => option.id !== editor.option?.id && sameName(option.option_name))) return "Lựa chọn đã tồn tại trong nhóm này.";
      const option: DraftOption = { id: editor.option?.id ?? crypto.randomUUID(), option_name: values.name, additional_price: values.price };
      setGroups((current) => current.map((entry) => entry.id !== editor.groupId ? entry : { ...entry,
        options: editor.option ? entry.options.map((value) => value.id === option.id ? option : value) : [...entry.options, option] }));
    }
    setGroupsChanged(true); setEditor(null);
  }

  function beverageTemplate() {
    setGroupsChanged(true);
    const templates: [string, boolean, string[], number[]][] = [
      ["Topping thêm", true, ["Trân châu đen", "Thạch trái cây", "Pudding"], [5000, 4000, 6000]],
      ["Mức đường", false, ["100%", "70%", "50%", "30%", "0%"], [0, 0, 0, 0, 0]],
      ["Mức đá", false, ["Bình thường", "Ít đá", "Không đá"], [0, 0, 0]],
    ];
    setGroups(templates.map(([name, multiple, names, prices]) => ({ id: crypto.randomUUID(), name,
      is_multiple: multiple, is_required: !multiple, options: names.map((option_name, index) => ({ id: crypto.randomUUID(), option_name, additional_price: prices[index] })) })));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    if (original && !useSellerMenuStore.getState().rows.some((row) => row.item.id === original.item.id)) {
      setError("Món này đã bị xóa. Hãy quay lại Menu."); return;
    }
    if (readingImage || (!image && (!original || Boolean(original.item.image_url))) || !name.trim() || !category || !price.trim() || !Number.isSafeInteger(basePrice) || basePrice < 0 || basePrice > 10000000) {
      setError("Vui lòng chọn ảnh hợp lệ, nhập tên, danh mục và giá nguyên từ 0 đến 10.000.000đ."); return;
    }
    if (groups.some((group) => !group.options.length)) { setError("Mỗi nhóm cần ít nhất một lựa chọn, hoặc hãy xóa nhóm trống."); return; }
    submitted.current = true; setSaving(true);
    const id = original?.item.id ?? crypto.randomUUID(), now = new Date().toISOString();
    const optionGroups: MenuOptionGroupDetail[] = groups.map((group) => {
      const previous = original?.optionGroups?.find((entry) => entry.id === group.id);
      return { ...group, menu_item_id: id,
        is_active: previous?.is_active ?? true, created_at: previous?.created_at ?? now, updated_at: now,
        options: group.options.map((option) => {
          const previousOption = previous?.options.find((entry) => entry.id === option.id);
          return { ...option, group_id: group.id, is_active: previousOption?.is_active ?? true,
            created_at: previousOption?.created_at ?? now, updated_at: now };
        }) };
    });
    // Data URLs and featuredPreview are demo-only. Production uploads must provide a storage URL.
    const updated: SellerMenuRow = { item: { id, restaurant_id: original?.item.restaurant_id ?? demoSellerRestaurant.id, name: name.trim(), category,
      price: basePrice, description: description.trim() || null, image_url: image,
      slug: original?.item.slug ?? `${normalizeSearchText(name.trim()).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mon"}-${id.slice(0, 8)}`,
      is_active: active, is_available: !outOfStock, created_at: original?.item.created_at ?? now, updated_at: now },
      optionGroups: original && !original.optionGroups && !groupsChanged ? undefined : optionGroups,
      optionCount: original && !original.optionGroups && !groupsChanged ? original.optionCount : groups.reduce((count, group) => count + group.options.length, 0),
      featuredPreview: featured };
    setRows((current) => original ? current.map((row) => row.item.id === id ? updated : row) : [updated, ...current]);
    router.push("/seller/menu");
  }

  function cancel() {
    if (JSON.stringify({ name, category, price, description, image, groups, active, outOfStock, featured }) !== initial.current && !window.confirm("Hủy các thông tin món chưa lưu?")) return;
    router.push("/seller/menu");
  }

  const saveButton = <button type="submit" className={styles.primary} disabled={saving || readingImage}><Save size={20} />{saving ? "Đang lưu…" : "Lưu món"}</button>;
  return <div className={shell.page}><StudentHeader variant="seller" /><div className={shell.workspace}>
    <SellerSidebar active="menu" name={shopName} />
    <main className={styles.main}>
      <form onSubmit={save}>
        <header className={styles.heading}><div><h1>{original ? "Chỉnh sửa món" : "Thêm món mới"}</h1><p>{original ? "Cập nhật thông tin món ăn trên menu cửa hàng của bạn." : "Tạo món mới để hiển thị trên menu cửa hàng của bạn."}</p></div><div className={styles.buttons}>
          <button type="button" className={styles.outline} onClick={() => preview.current?.scrollIntoView({ behavior: "smooth", block: "center" })}><Eye size={20} />Xem trước</button>{saveButton}
        </div></header>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.columns}><div className={styles.left}>
          <section className={styles.card}><h2>Thông tin cơ bản</h2><div className={styles.basic}>
            <div className={styles.uploadField}><span>Ảnh món {(!original || original.item.image_url) && <b>*</b>}</span>
              <button type="button" className={styles.upload} onClick={() => upload.current?.click()} aria-label="Tải hoặc thay ảnh món ăn">
                {image ? <Image src={image} alt="Ảnh món đã chọn" width={300} height={220} unoptimized /> : <><ImagePlus size={42} /><strong>{readingImage ? "Đang tải ảnh lên Cloudinary…" : "Tải ảnh món ăn"}</strong><small>JPG, PNG, WEBP tối đa 5MB</small></>}
              </button>
              <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { void readImage(event.target.files?.[0]); event.target.value = ""; }} />
              {image && <button type="button" className={styles.textButton} onClick={() => { uploadRequestId.current++; setReadingImage(false); setImage(null); }}>Xóa ảnh</button>}
            </div>
            <div className={styles.fields}>
              <label>Tên món <b>*</b><input required maxLength={120} placeholder="Ví dụ: Trà sữa truyền thống" value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label>Danh mục <b>*</b><select required value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Giá bán <b>*</b><div className={styles.priceInput}><input required type="number" min={0} max={10000000} step={1} placeholder="Nhập giá bán" value={price} onChange={(event) => setPrice(event.target.value)} /><span>đ</span></div></label>
              <label>Mô tả ngắn<div className={styles.description}><textarea maxLength={160} placeholder="Giới thiệu ngắn về món ăn của bạn…" value={description} onChange={(event) => setDescription(event.target.value)} /><small>{description.length}/160</small></div></label>
            </div>
          </div></section>
          <section className={styles.card}><div className={styles.sectionHeading}><h2>Tùy chọn món</h2><p>Tạo các nhóm topping, mức đường, mức đá hoặc món thêm.</p></div>
            {original && !original.optionGroups && original.optionCount > 0 && !groupsChanged && <p className={styles.demo}>Món mẫu chỉ có số lượng {original.optionCount} tùy chọn, chưa có dữ liệu chi tiết. Số lượng này được giữ nguyên nếu bạn không thêm nhóm mới.</p>}
            {!groups.length && <div className={styles.empty}><p>Món không có tùy chọn vẫn có thể lưu.</p><button type="button" className={styles.outline} onClick={beverageTemplate}>Dùng mẫu đồ uống</button></div>}
            <div className={styles.groups}>{groups.map((group) => <article key={group.id} className={styles.group}>
              <header><strong>{group.name}</strong><span>{group.is_multiple ? "Chọn nhiều" : "Chọn một"}{group.is_required ? " · Bắt buộc" : ""}</span><div className={styles.groupActions}>
                <button type="button" aria-label={`Sửa nhóm ${group.name}`} onClick={() => setEditor({ type: "group", group })}><Pencil size={17} /></button>
                <button type="button" aria-label={`Xóa nhóm ${group.name}`} onClick={() => { if (window.confirm(`Xóa nhóm “${group.name}” và các lựa chọn?`)) { setGroupsChanged(true); setGroups((current) => current.filter((entry) => entry.id !== group.id)); } }}><Trash2 size={17} /></button>
              </div></header>
              <div className={styles.chips}>{group.options.map((option) => <span key={option.id} className={styles.chip}>
                <button type="button" title="Chỉnh sửa lựa chọn" onClick={() => setEditor({ type: "option", groupId: group.id, option })}>{option.option_name}{option.additional_price > 0 && <b>+{formatMoney(option.additional_price)}</b>}</button>
                <button type="button" aria-label={`Xóa ${option.option_name} trong ${group.name}`} onClick={() => { setGroupsChanged(true); setGroups((current) => current.map((entry) => entry.id === group.id ? { ...entry, options: entry.options.filter((value) => value.id !== option.id) } : entry)); }}><X size={14} /></button>
              </span>)}<button type="button" className={styles.addChoice} onClick={() => setEditor({ type: "option", groupId: group.id })}><Plus size={16} />Thêm lựa chọn</button></div>
            </article>)}</div>
            <button type="button" className={styles.addGroup} onClick={() => setEditor({ type: "group" })}><Plus size={21} />Thêm nhóm tùy chọn</button>
          </section>
          <section className={styles.card}><h2>Trạng thái hiển thị</h2><div className={styles.switches}>
            {([{ label: "Đang bán", text: "Hiển thị cho sinh viên", value: active, change: setActive },
              { label: "Tạm hết", text: "Không thể đặt nhưng vẫn giữ trong menu", value: outOfStock, change: setOutOfStock },
              { label: "Món nổi bật", text: "Chỉ xem trước trong demo, chưa lưu DB", value: featured, change: setFeatured }]).map((entry) => <label key={entry.label} className={styles.switchLabel}><input type="checkbox" role="switch" checked={entry.value} onChange={(event) => entry.change(event.target.checked)} /><span><strong>{entry.label}</strong><small>{entry.text}</small></span></label>)}
          </div></section>
        </div><aside className={styles.right}>
          <section ref={preview} className={styles.card}><h2>Xem trước với sinh viên</h2><div className={styles.preview}>
            <div className={styles.previewImage}>{image ? <Image src={image} width={120} height={150} alt={name || "Ảnh món"} unoptimized /> : <FoodThumbnail kind={category === "Đồ uống" ? "drink" : "food"} />}</div>
            <div className={styles.previewCopy}><div><h3>{name.trim() || "Tên món của bạn"}</h3><strong className={styles.money}>{formatMoney(basePrice)}</strong></div>
              <p><Settings2 size={16} />{groups.length ? "Có tùy chọn thêm" : "Không có tùy chọn"}</p><p><Store size={16} />{shopName}</p>
              <footer><span className={styles.badge} data-selling={active && !outOfStock}>● {status}</span><button type="button" className={styles.outline} onClick={() => setError("Đây là thẻ xem trước. Món demo chưa được nối vào trang chi tiết của sinh viên.")}>Xem món</button></footer>
            </div></div>{description && <p className={styles.previewDescription}>{description}</p>}
          </section>
          <section className={styles.card}><h2>Tóm tắt</h2><dl className={styles.summary}>
            <div><dt><Tag size={18} />Danh mục</dt><dd>{category}</dd></div><div><dt><Tag size={18} />Giá gốc</dt><dd>{formatMoney(basePrice)}</dd></div>
            <div><dt><ClipboardList size={18} />Số nhóm tùy chọn</dt><dd>{groups.length}</dd></div><div><dt><Eye size={18} />Trạng thái</dt><dd>{status}</dd></div>
          </dl></section>
          <section className={styles.card}><h2 className={styles.tipsHeading}><Lightbulb />Gợi ý hoàn thiện</h2>{[
            { label: "Thêm ảnh món", text: "Ảnh rõ nét giúp món ăn thu hút hơn.", done: Boolean(image) },
            { label: "Viết mô tả ngắn", text: "Giúp sinh viên dễ lựa chọn.", done: Boolean(description.trim()) },
            { label: "Tạo nhóm tùy chọn", text: "Thêm topping, mức đường, mức đá nếu có.", done: groups.length > 0 },
            { label: "Kiểm tra giá bán", text: "Đảm bảo giá phù hợp và chính xác.", done: price.trim() !== "" && Number.isSafeInteger(basePrice) && basePrice >= 0 && basePrice <= 10000000 },
          ].map((tip) => <div className={styles.tip} key={tip.label}><span data-done={tip.done}>{tip.done && <Check size={16} />}</span><div><strong>{tip.label}</strong><small>{tip.text}</small></div></div>)}</section>
          <div className={styles.bottomActions}><button type="button" className={styles.outline} onClick={cancel}>Hủy</button>{saveButton}</div>
          <p className={styles.demo}>Demo frontend · Chưa ghi DB. Các thay đổi mất khi tải lại trang.</p>
        </aside></div>
      </form>
    </main>
    {editor && <OptionEditor key={editor.type === "group" ? editor.group?.id ?? "new-group" : editor.option?.id ?? `new-${editor.groupId}`} editor={editor} onClose={() => setEditor(null)} onSave={saveEditor} />}
  </div></div>;
}
