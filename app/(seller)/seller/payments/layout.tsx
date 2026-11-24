import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellerAccessServices } from "@/services/seller-access.service";
import { resolveAllowedSellerTabs } from "@/types/seller-access.types";

export default async function SellerPaymentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  let access = null;
  try {
    access = await SellerAccessServices.read(await createClient());
  } catch {
    // Handled by parent (seller)/layout.tsx
  }

  if (access && !resolveAllowedSellerTabs(access).includes("payments")) {
    redirect(access.default_tab ?? "/seller/orders");
  }

  return children;
}
