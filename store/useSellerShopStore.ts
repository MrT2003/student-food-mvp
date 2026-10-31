"use client";

import { create } from "zustand";
import type { SellerPreview } from "@/store/useSellerPreviewStore";
import { demoSellerRestaurant } from "@/lib/mocks/seller-orders.mock";

export type ShopDay = { label: string; enabled: boolean; opens: string; closes: string };
export type SellerShopPreview = {
  name: string; description: string; location: string; avatar_url: string | null;
  // UI-only until the backend contract is connected (restaurants has no phone column).
  contactPhonePreview: string; openPreview: boolean; startPausedPreview: boolean;
  daysPreview: ShopDay[]; scheduleModePreview: "same" | "daily";
};
export const useSellerShopStore = create<{
  shop: SellerShopPreview | null;
  initialize: (draft: SellerPreview | null) => void;
  update: (fields: Partial<SellerShopPreview>) => void;
}>((set) => ({
  shop: null,
  initialize: (draft) => set((state) => {
    if (state.shop) return state;
    const hours = draft?.hours.match(/(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
    return { shop: { name: draft?.name || demoSellerRestaurant.name,
      description: draft?.description || demoSellerRestaurant.description || "",
      location: draft?.location || demoSellerRestaurant.location || "KTX A", avatar_url: draft?.avatar_url ?? null,
      contactPhonePreview: "0901 234 567", openPreview: false, startPausedPreview: true,
      scheduleModePreview: "same", daysPreview: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => ({
        label, enabled: label !== "CN", opens: hours?.[1] ?? "10:00", closes: hours?.[2] ?? "14:00",
      })) } };
  }),
  update: (fields) => set((state) => state.shop ? { shop: { ...state.shop, ...fields } } : state),
}));
