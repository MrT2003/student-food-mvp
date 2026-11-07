import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellerAccessServices, SellerAccessError } from "@/services/seller-access.service";
import SellerAccessProblem from "@/components/features/seller/SellerAccessProblem";
export default async function SellerLayout({ children }: {
    children: ReactNode;
}) {
    let access, code = "";
    try {
        access = await SellerAccessServices.read(await createClient());
    }
    catch (e) {
        code = e instanceof SellerAccessError ? e.code : "ACCESS_READ_FAILED";
    }
    if (code === "UNAUTHORIZED")
        redirect("/auth/login?next=%2Fseller");
    if (access?.user.role === "student")
        redirect("/account");
    if (!access?.restaurant)
        return <SellerAccessProblem />;
    return children;
}
