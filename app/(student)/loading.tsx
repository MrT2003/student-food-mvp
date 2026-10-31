import CatalogLoading from "@/components/features/home/CatalogLoading";

// Next tạo Suspense boundary tự động, giữ layout/MenuBar khi page đang chờ server.
export default function Loading() {
  return <CatalogLoading />;
}
