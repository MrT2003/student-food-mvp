import ShipperLoader from "@/components/ui/ShipperLoader";
import styles from "@/styles/catalog-loading.module.css";

// Server Component: hiển thị loader shipper căn giữa gọn nhẹ trong lúc chờ server lấy dữ liệu.
export default function CatalogLoading({
  title = "Đang tải nội dung",
  subtitle = "Đang lấy thực đơn...",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <section aria-busy="true" aria-label={title} className={styles.container}>
      <ShipperLoader label={subtitle} fullPage />
    </section>
  );
}
