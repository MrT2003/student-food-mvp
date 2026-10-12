"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// UI draft only: never use this state to authorize seller access or create orders.
export type SellerPreview = {
  name: string;
  description: string;
  location: string;
  cash: boolean;
  bank: boolean;
  hours: string;
};

export const useSellerPreviewStore = create<{
  draft: SellerPreview | null;
  registerPreview: (draft: SellerPreview) => void;
}>()(
  persist(
    (set) => ({ draft: null, registerPreview: (draft) => set({ draft }) }),
    {
      name: "student-food:seller-registration-preview:v1",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ draft }) => ({ draft }),
      skipHydration: true,
    },
  ),
);

export function useSellerPreview() {
  const draft = useSellerPreviewStore((state) => state.draft);
  useEffect(() => {
    void useSellerPreviewStore.persist.rehydrate();
  }, []);
  return draft;
}
