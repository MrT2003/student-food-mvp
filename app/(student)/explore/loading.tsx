import CatalogLoading from "@/components/features/home/CatalogLoading";

// Fallback riêng cho Khám Phá: điều hướng có phản hồi trước khi query catalog xong.
export default function Loading() {
  return <CatalogLoading title="Khám phá" />;
}
