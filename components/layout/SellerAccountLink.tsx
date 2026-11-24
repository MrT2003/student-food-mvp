"use client";
import Link from "next/link";
import { Store } from "lucide-react";
import { useSellerAccess } from "@/components/features/seller/SellerAccessProvider";
export default function SellerAccountLink({ onNavigate }: {
    onNavigate: () => void;
}) {
    const { data, error, loading, retry } = useSellerAccess();
    if (loading && !data)
        return <span role="status">Đang tải cửa hàng…</span>;
    if (error)
        return <button type="button" onClick={retry}>Không tải được cửa hàng · Thử lại</button>;
    if (!data)
        return null;
    const shop = data.restaurant;
    return <Link href={shop ? "/seller" : "/seller/register"} onClick={onNavigate} title={shop?.name}>
    <Store aria-hidden="true"/><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shop?.name ?? "Đăng ký bán hàng"}</span>
  </Link>;
}
