"use client";

import { create } from "zustand";
import type { Database } from "@/types/database.types";
import type { SellerPreview } from "@/store/useSellerPreviewStore";

type BankFields = Pick<Database["public"]["Tables"]["restaurant_banks"]["Row"], "bank_name" | "account_no" | "account_name">;
export type SellerPaymentPreview = BankFields & {
  cashEnabledPreview: boolean; bankEnabledPreview: boolean;
  // Presentation settings only: these are not columns in restaurant_banks.
  branchPreview: string;
};
export const useSellerPaymentStore = create<{
  saved: SellerPaymentPreview | null;
  initialize: (draft: SellerPreview | null) => void;
  save: (values: SellerPaymentPreview) => void;
}>((set) => ({
  saved: null,
  initialize: (draft) => set((state) => state.saved ? state : { saved: {
    cashEnabledPreview: draft?.cash ?? true, bankEnabledPreview: draft?.bank ?? true,
    bank_name: "Vietcombank", account_no: "0901234567", account_name: "NGUYEN VAN A",
    branchPreview: "Chi nhánh Hà Nội",
  } }),
  save: (saved) => set({ saved }),
}));
