import styles from "@/styles/catalog-loading.module.css";

// Server Component: tiêu đề và khung nội dung có thể xuất hiện khi catalog vẫn đang tải.
// Không chờ JS phía browser và không cần gọi thêm request để dựng skeleton.
export default function CatalogLoading({ title = "Đang tải nội dung" }: { title?: string }) {
  return (
    <section aria-busy="true" aria-label={title} className={styles.container}>
      <h1>{title}</h1>
      <p role="status">Đang tải quán ăn và món ngon…</p>
      <div className={styles.search} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div className={styles.card} key={index}>
            <div className={styles.image} />
            <div className={styles.line} />
            <div className={styles.shortLine} />
          </div>
        ))}
      </div>
    </section>
  );
}
