"use client";

import { create } from "zustand";
import { createSellerMenuFixtures, type SellerMenuRow } from "@/lib/seller/menu";
import { demoSellerRestaurant } from "@/lib/mocks/seller-orders.mock";

// Frontend demo only. Replace these actions with the menu API when connected.
interface SellerMenuState {
  rows: SellerMenuRow[];
  setRows: (update: (rows: SellerMenuRow[]) => SellerMenuRow[]) => void;
}
export const useSellerMenuStore = create<SellerMenuState>((set) => ({
  rows: createSellerMenuFixtures(demoSellerRestaurant.id),
  setRows: (update) => set((state) => ({ rows: update(state.rows) })),
}));
