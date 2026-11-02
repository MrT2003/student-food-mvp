"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSellerAccess } from "./SellerAccessProvider";
import SellerAccessProblem from "./SellerAccessProblem";
export default function SellerRegistrationGate({ children }: {
    children: ReactNode;
}) {
    const { data, loading } = useSellerAccess();
    const router = useRouter();
    const registered = !!data?.restaurant && data.user.role === "seller";
    useEffect(() => { if (registered)
        router.replace("/seller"); }, [registered, router]);
    if ((loading && !data) || registered)
        return <p role="status">Đang kiểm tra cửa hàng…</p>;
    if (data?.user.role !== "student" || data.restaurant)
        return <SellerAccessProblem />;
    return children;
}
