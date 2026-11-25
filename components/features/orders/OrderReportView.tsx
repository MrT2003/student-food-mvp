"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileText,
  ImagePlus,
  MessageCircleMore,
  Send,
  Ticket,
  Upload,
  X,
} from "lucide-react";
import { useOrderDetail } from "@/lib/orders/useOrderDetail";
import { previewOrders, toOrderCardViewModel } from "./orders-mock-data";
import OrderFoodMedia, { type OrderArtworkKind } from "./OrderFoodMedia";
import styles from "@/styles/order-report.module.css";

const ISSUE_OPTIONS = [
  "Thiếu món",
  "Giao sai món / sai tùy chọn",
  "Chất lượng món ăn chưa đảm bảo",
  "Đơn hàng giao chậm quá lâu",
  "Vấn đề về thanh toán / chuyển khoản",
  "Thái độ phục vụ / giao hàng",
  "Vấn đề khác",
] as const;

const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_IMAGES = 5;

type EvidencePreview = {
  id: string;
  label: string;
  kind: "meal-box" | "receipt" | "bag" | "custom";
  dataUrl?: string;
};

const INITIAL_DEMO_PREVIEWS: EvidencePreview[] = [
  { id: "demo-1", label: "Ảnh hộp cơm thực tế", kind: "meal-box" },
  { id: "demo-2", label: "Ảnh phiếu tạm tính", kind: "receipt" },
  { id: "demo-3", label: "Ảnh túi đóng gói", kind: "bag" },
];

function DemoEvidenceIllustration({ item }: { item: EvidencePreview }) {
  if (item.dataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.dataUrl} alt={item.label} className={styles.evidenceImg} />
    );
  }

  if (item.kind === "meal-box") {
    return (
      <svg
        viewBox="0 0 180 128"
        className={styles.evidenceSvg}
        aria-hidden="true"
      >
        <rect width="180" height="128" rx="14" fill="#d8cfc6" />
        <rect
          x="14"
          y="10"
          width="152"
          height="108"
          rx="12"
          fill="#f7f4ef"
          stroke="#e2dad0"
          strokeWidth="2"
        />
        <rect x="22" y="18" width="136" height="92" rx="9" fill="#efe9e0" />
        {/* Cơm trắng & đồ chua */}
        <ellipse cx="92" cy="42" rx="28" ry="18" fill="#ffffff" />
        <path
          d="M78 36 Q92 28 104 38 M80 44 Q94 36 106 45"
          stroke="#f0934b"
          strokeWidth="2.5"
          fill="none"
        />
        {/* Sườn / thịt nướng */}
        <ellipse cx="48" cy="54" rx="20" ry="14" fill="#8f3b18" />
        <ellipse cx="52" cy="74" rx="22" ry="14" fill="#a8461c" />
        <ellipse cx="44" cy="88" rx="18" ry="11" fill="#782f12" />
        {/* Dưa leo & rau */}
        <circle cx="118" cy="54" r="12" fill="#6bc247" />
        <circle cx="118" cy="54" r="7" fill="#c7f0a8" />
        <circle cx="136" cy="48" r="12" fill="#5ab338" />
        <circle cx="136" cy="48" r="7" fill="#bce89b" />
        <circle cx="132" cy="68" r="12" fill="#68bf45" />
        <circle cx="132" cy="68" r="7" fill="#c7f0a8" />
        <path
          d="M92 86 C102 74, 134 78, 146 92 C132 104, 100 102, 92 86 Z"
          fill="#f27822"
        />
      </svg>
    );
  }

  if (item.kind === "receipt") {
    return (
      <svg
        viewBox="0 0 180 128"
        className={styles.evidenceSvg}
        aria-hidden="true"
      >
        <rect width="180" height="128" rx="14" fill="#cfc9c2" />
        <rect
          x="26"
          y="6"
          width="128"
          height="116"
          rx="4"
          fill="#faf8f5"
          stroke="#ded8d0"
        />
        <text
          x="90"
          y="25"
          textAnchor="middle"
          fill="#1b2234"
          fontSize="11"
          fontWeight="800"
        >
          Cơm Cô Ba
        </text>
        <text
          x="90"
          y="39"
          textAnchor="middle"
          fill="#4a5568"
          fontSize="8.5"
          fontWeight="700"
        >
          PHIẾU TẠM TÍNH
        </text>
        <line
          x1="38"
          y1="47"
          x2="142"
          y2="47"
          stroke="#cbd5e1"
          strokeDasharray="3 2"
        />
        <text x="38" y="62" fill="#334155" fontSize="8.5">
          Cơm sườn
        </text>
        <text x="102" y="62" fill="#334155" fontSize="8.5">
          2
        </text>
        <text x="142" y="62" textAnchor="end" fill="#1e293b" fontSize="8.5">
          60.000
        </text>
        <text x="38" y="76" fill="#334155" fontSize="8.5">
          Trà tắc
        </text>
        <text x="102" y="76" fill="#334155" fontSize="8.5">
          1
        </text>
        <text x="142" y="76" textAnchor="end" fill="#1e293b" fontSize="8.5">
          15.000
        </text>
        <line x1="38" y1="86" x2="142" y2="86" stroke="#cbd5e1" />
        <text x="38" y="102" fill="#0f172a" fontSize="9.5" fontWeight="800">
          Tổng cộng
        </text>
        <text
          x="142"
          y="102"
          textAnchor="end"
          fill="#0f172a"
          fontSize="10"
          fontWeight="800"
        >
          135.000
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 180 128"
      className={styles.evidenceSvg}
      aria-hidden="true"
    >
      <rect width="180" height="128" rx="14" fill="#5c3822" />
      <ellipse cx="90" cy="112" rx="70" ry="18" fill="#3d2415" />
      {/* Túi nilon đóng gói */}
      <path
        d="M44 26 C52 12, 72 18, 76 34 L104 34 C108 18, 128 12, 136 26 L146 98 C146 110, 34 110, 34 98 Z"
        fill="#f3e9dc"
        opacity="0.92"
      />
      <rect x="48" y="54" width="84" height="44" rx="8" fill="#e5d4be" />
      <circle
        cx="90"
        cy="74"
        r="15"
        fill="#fff8f2"
        stroke="#d9381e"
        strokeWidth="2.2"
      />
      <path
        d="M83 75 C85 81, 95 81, 97 75 Z"
        fill="#d9381e"
      />
      <text
        x="90"
        y="101"
        textAnchor="middle"
        fill="#b8321a"
        fontSize="8.5"
        fontWeight="700"
      >
        Cơm Cô Ba
      </text>
    </svg>
  );
}

export default function OrderReportView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const storeOrder = useOrderDetail(orderId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resolvedOrder = (() => {
    if (storeOrder) {
      const cardVm = toOrderCardViewModel(storeOrder);
      return {
        id: storeOrder.id,
        orderCode: storeOrder.orderCode,
        restaurantName: storeOrder.restaurantName,
        kind: storeOrder.kind,
        artwork: cardVm.artwork,
        imageUrl: cardVm.imageUrl,
      };
    }

    const matchedPreview = previewOrders.find(
      (entry) =>
        entry.id.toLowerCase() === orderId.toLowerCase() ||
        entry.orderCode.toLowerCase() === orderId.toLowerCase(),
    );

    if (matchedPreview) {
      return {
        id: matchedPreview.id,
        orderCode: matchedPreview.orderCode,
        restaurantName: matchedPreview.restaurantName,
        kind: matchedPreview.kind,
        artwork: matchedPreview.artwork,
        imageUrl: matchedPreview.imageUrl,
      };
    }

    return {
      id: orderId,
      orderCode: orderId.startsWith("SF") ? orderId : "SF0128",
      restaurantName: "Cơm Cô Ba",
      kind: "food" as const,
      artwork: "com-co-ba" as OrderArtworkKind,
      imageUrl: null,
    };
  })();

  const [issueType, setIssueType] = useState<string>(ISSUE_OPTIONS[0]);
  const [description, setDescription] = useState<string>(
    "Mình đặt 2 phần cơm sườn nhưng chỉ nhận được 1 phần. Mong quán kiểm tra và hỗ trợ giúp mình.",
  );
  const [previews, setPreviews] = useState<EvidencePreview[]>(
    () => INITIAL_DEMO_PREVIEWS,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState<string>("");
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const sampleReportCode = `#RP${resolvedOrder.orderCode.replace(/^#?SF/i, "") || "0128"}`;

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setNotice("");

    const remainingSlots = MAX_IMAGES - previews.length;
    if (remainingSlots <= 0) {
      setNotice("Bạn đã thêm tối đa 5 ảnh minh chứng.");
      return;
    }

    const acceptedFiles = Array.from(files).slice(0, remainingSlots);
    for (const file of acceptedFiles) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setNotice("Chỉ hỗ trợ định dạng ảnh JPG, PNG.");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setNotice(`Ảnh "${file.name}" vượt quá dung lượng tối đa 5MB.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const resultUrl =
          typeof reader.result === "string" ? reader.result : undefined;
        if (!resultUrl) return;
        setPreviews((prev) => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              label: file.name,
              kind: "custom",
              dataUrl: resultUrl,
            },
          ];
        });
      };
      reader.readAsDataURL(file);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFilesSelected(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFilesSelected(event.dataTransfer.files);
  }

  function handleRemovePreview(id: string) {
    setPreviews((prev) => prev.filter((item) => item.id !== id));
    setNotice("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issueType.trim()) {
      setNotice("Vui lòng chọn vấn đề bạn đang gặp phải.");
      return;
    }
    if (!description.trim()) {
      setNotice("Vui lòng nhập mô tả vấn đề của đơn hàng.");
      return;
    }

    setSubmittedCode(sampleReportCode);
    setNotice(
      `Đã ghi nhận bản xem trước báo cáo (${sampleReportCode}) cho đơn #${resolvedOrder.orderCode}. Chức năng lưu xuống cơ sở dữ liệu sẽ do team Backend kết nối.`,
    );
  }

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/orders">Đơn hàng</Link>
        <span aria-hidden="true">/</span>
        <span>Báo cáo vấn đề</span>
      </nav>

      <header className={styles.headerRow}>
        <div className={styles.headingText}>
          <h1>Báo cáo vấn đề với đơn hàng</h1>
          <p>Cho chúng tôi biết vấn đề để được hỗ trợ.</p>
        </div>

        <button
          type="button"
          className={styles.myReportsButton}
          onClick={() =>
            setNotice(
              "Danh sách \"Báo cáo của tôi\" đang ở chế độ giao diện mẫu (chờ team Backend kết nối API).",
            )
          }
        >
          <FileText size={18} strokeWidth={2.1} aria-hidden="true" />
          <span>Báo cáo của tôi</span>
          <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </header>

      {notice && (
        <div
          className={`${styles.noticeBanner} ${
            submittedCode ? styles.noticeSuccess : ""
          }`}
          role="status"
        >
          <p>{notice}</p>
          <button type="button" onClick={() => setNotice("")}>
            Đóng
          </button>
        </div>
      )}

      <div className={styles.layoutGrid}>
        <section
          className={styles.formCard}
          aria-labelledby="report-form-heading"
        >
          <div className={styles.formCardTop}>
            <h2 id="report-form-heading">Nội dung báo cáo</h2>
            <span className={styles.requiredHint}>
              <strong>*</strong> Thông tin bắt buộc
            </span>
          </div>

          <div className={styles.orderSummaryBanner}>
            <div className={styles.orderSummaryLeft}>
              <OrderFoodMedia
                artwork={resolvedOrder.artwork}
                kind={resolvedOrder.kind}
                imageUrl={resolvedOrder.imageUrl}
                className={styles.orderThumb}
              />

              <div className={styles.orderSummaryMeta}>
                <h3>{resolvedOrder.restaurantName}</h3>
                <p>Đơn hàng #{resolvedOrder.orderCode}</p>
              </div>
            </div>

            <Link
              href={`/orders/${encodeURIComponent(resolvedOrder.id)}`}
              className={styles.viewOrderLink}
            >
              <span>Xem chi tiết đơn</span>
              <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </div>

          <form className={styles.reportForm} onSubmit={handleSubmit}>
            <div className={styles.fieldGroup}>
              <label htmlFor="report-issue-type" className={styles.fieldLabel}>
                Bạn gặp vấn đề gì? <span className={styles.asterisk}>*</span>
              </label>

              <div className={styles.selectWrapper}>
                <select
                  id="report-issue-type"
                  value={issueType}
                  onChange={(event) => setIssueType(event.target.value)}
                  className={styles.selectInput}
                >
                  {ISSUE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={20}
                  strokeWidth={2.2}
                  className={styles.selectIcon}
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label
                htmlFor="report-issue-description"
                className={styles.fieldLabel}
              >
                Mô tả vấn đề <span className={styles.asterisk}>*</span>
              </label>

              <textarea
                id="report-issue-description"
                rows={4}
                maxLength={MAX_DESCRIPTION_LENGTH}
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value.slice(0, MAX_DESCRIPTION_LENGTH),
                  )
                }
                placeholder="Nêu rõ món đã đặt và vấn đề bạn gặp phải..."
                className={styles.textareaInput}
              />

              <div className={styles.textareaFooter}>
                <span>Nêu rõ món đã đặt và vấn đề bạn gặp phải.</span>
                <span>
                  {description.length}/{MAX_DESCRIPTION_LENGTH}
                </span>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>
                Ảnh minh chứng{" "}
                <span className={styles.optionalTag}>(Không bắt buộc)</span>
              </div>

              <div
                className={`${styles.uploadDropzone} ${
                  isDragging ? styles.uploadDropzoneActive : ""
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className={styles.hiddenFileInput}
                  onChange={handleFileChange}
                />

                <span className={styles.uploadIconCircle}>
                  <Upload size={22} strokeWidth={2.2} aria-hidden="true" />
                </span>

                <div className={styles.uploadDropzoneText}>
                  <p>
                    Kéo thả ảnh vào đây hoặc{" "}
                    <span className={styles.chooseFileLink}>chọn ảnh</span>
                  </p>
                  <span>JPG, PNG · Tối đa 5MB/ảnh · Tối đa 5 ảnh</span>
                </div>
              </div>

              <div className={styles.evidenceRow}>
                <div className={styles.evidenceList}>
                  {previews.map((item) => (
                    <div key={item.id} className={styles.evidenceCard}>
                      <DemoEvidenceIllustration item={item} />
                      <button
                        type="button"
                        className={styles.removeEvidenceBtn}
                        aria-label={`Xóa ${item.label}`}
                        onClick={() => handleRemovePreview(item.id)}
                      >
                        <X size={15} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>

                <span className={styles.evidenceCounter}>
                  Đã thêm {previews.length}/{MAX_IMAGES} ảnh
                </span>
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() =>
                  router.push(`/orders/${encodeURIComponent(resolvedOrder.id)}`)
                }
              >
                Hủy
              </button>

              <button type="submit" className={styles.submitButton}>
                <Send size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>Gửi báo cáo</span>
              </button>
            </div>
          </form>
        </section>

        <aside className={styles.sideColumn}>
          <section
            className={styles.sideCard}
            aria-labelledby="report-tips-heading"
          >
            <div className={styles.sideCardHeading}>
              <span className={styles.sideHeadingOutlineIcon}>
                <CircleAlert size={22} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <h2 id="report-tips-heading">Gửi báo cáo rõ ràng hơn</h2>
            </div>

            <ul className={styles.tipList}>
              <li className={styles.tipItem}>
                <span className={styles.tipIconBox}>
                  <FileText size={20} strokeWidth={2.1} aria-hidden="true" />
                </span>
                <div>
                  <h3>Mô tả cụ thể</h3>
                  <p>Nêu rõ món hoặc khoản thanh toán gặp vấn đề.</p>
                </div>
              </li>

              <li className={styles.tipItem}>
                <span className={styles.tipIconBox}>
                  <ImagePlus size={20} strokeWidth={2.1} aria-hidden="true" />
                </span>
                <div>
                  <h3>Thêm ảnh nếu có</h3>
                  <p>Ảnh món nhận được hoặc hóa đơn giúp làm rõ sự việc.</p>
                </div>
              </li>

              <li className={styles.tipItem}>
                <span className={styles.tipIconBox}>
                  <MessageCircleMore
                    size={20}
                    strokeWidth={2.1}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <h3>Theo dõi phản hồi</h3>
                  <p>Xem cập nhật tại mục “Báo cáo của tôi”.</p>
                </div>
              </li>
            </ul>
          </section>

          <section
            className={styles.sideCard}
            aria-labelledby="after-report-heading"
          >
            <div className={styles.sideCardHeading}>
              <span className={styles.sideHeadingOutlineIcon}>
                <CircleCheck size={22} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <h2 id="after-report-heading">Sau khi gửi báo cáo</h2>
            </div>

            <p className={styles.afterReportText}>
              Bạn sẽ nhận được mã báo cáo để theo dõi quá trình xử lý.
            </p>

            <div className={styles.reportCodeBadge}>
              <Ticket size={20} strokeWidth={2.1} aria-hidden="true" />
              <span>
                Ví dụ: mã báo cáo <strong>{sampleReportCode}</strong>
              </span>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
