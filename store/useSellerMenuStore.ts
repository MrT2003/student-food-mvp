"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { MenuItem, MenuOptionGroupDetail } from "@/types/restaurant.types";
import type { SellerMenuRow } from "@/lib/seller/menu";

interface SellerMenuState {
  restaurantId: string | null;
  loading: boolean;
  rows: SellerMenuRow[];
  setRows: (update: (rows: SellerMenuRow[]) => SellerMenuRow[]) => void;
  loadRestaurantMenu: (restaurantId: string) => Promise<void>;
  saveMenuItem: (row: SellerMenuRow, isUpdate: boolean) => Promise<void>;
  updateMenuItemFields: (id: string, fields: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
}

export const useSellerMenuStore = create<SellerMenuState>((set, get) => ({
  restaurantId: null,
  loading: false,
  rows: [],
  setRows: (update) => set((state) => ({ rows: update(state.rows) })),

  loadRestaurantMenu: async (restaurantId: string) => {
    if (!restaurantId) return;
    if (get().restaurantId !== restaurantId) {
      set({ restaurantId, rows: [], loading: true });
    } else {
      set({ loading: true });
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("menu_items")
        .select(`
          *,
          option_groups:menu_item_option_groups (
            *,
            options:menu_item_options (*)
          )
        `)
        .eq("restaurant_id", restaurantId)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Failed to load seller menu items:", error);
        return;
      }

      const mappedRows: SellerMenuRow[] = (data ?? []).map((entry) => {
        const { option_groups, ...item } = entry as MenuItem & {
          option_groups?: MenuOptionGroupDetail[];
        };
        const groups = (option_groups ?? []).map((g) => ({
          ...g,
          options: g.options ?? [],
        }));
        const optionCount = groups.reduce(
          (sum, g) => sum + g.options.length,
          0,
        );
        return {
          item,
          optionGroups: groups,
          optionCount,
        };
      });

      if (get().restaurantId === restaurantId) {
        set({ rows: mappedRows });
      }
    } finally {
      if (get().restaurantId === restaurantId) {
        set({ loading: false });
      }
    }
  },

  saveMenuItem: async (row: SellerMenuRow, isUpdate: boolean) => {
    set((state) => ({
      rows: isUpdate
        ? state.rows.map((r) => (r.item.id === row.item.id ? row : r))
        : [row, ...state.rows],
    }));

    const supabase = createClient();
    const { item, optionGroups } = row;

    const { error: itemError } = await supabase.from("menu_items").upsert(
      {
        id: item.id,
        restaurant_id: item.restaurant_id,
        name: item.name,
        slug: item.slug,
        category: item.category,
        price: item.price,
        description: item.description,
        image_url: item.image_url,
        is_active: item.is_active,
        is_available: item.is_available,
        created_at: item.created_at,
        updated_at: item.updated_at,
      },
      { onConflict: "id" },
    );

    if (itemError) {
      throw new Error(itemError.message);
    }

    if (optionGroups !== undefined) {
      const { data: existingGroups } = await supabase
        .from("menu_item_option_groups")
        .select("id")
        .eq("menu_item_id", item.id);

      const existingIds = (existingGroups ?? []).map((g) => g.id);
      if (existingIds.length > 0) {
        await supabase
          .from("menu_item_options")
          .delete()
          .in("group_id", existingIds);
        await supabase
          .from("menu_item_option_groups")
          .delete()
          .eq("menu_item_id", item.id);
      }

      if (optionGroups.length > 0) {
        const groupPayloads = optionGroups.map((g) => ({
          id: g.id,
          menu_item_id: item.id,
          name: g.name,
          is_multiple: g.is_multiple,
          is_required: g.is_required,
          is_active: g.is_active,
          created_at: g.created_at,
          updated_at: g.updated_at,
        }));
        const { error: groupsError } = await supabase
          .from("menu_item_option_groups")
          .insert(groupPayloads);
        if (groupsError) throw new Error(groupsError.message);

        const optionPayloads = optionGroups.flatMap((g) =>
          g.options.map((opt) => ({
            id: opt.id,
            group_id: g.id,
            option_name: opt.option_name,
            additional_price: opt.additional_price,
            is_active: opt.is_active,
            created_at: opt.created_at,
            updated_at: opt.updated_at,
          })),
        );
        if (optionPayloads.length > 0) {
          const { error: optionsError } = await supabase
            .from("menu_item_options")
            .insert(optionPayloads);
          if (optionsError) throw new Error(optionsError.message);
        }
      }
    }
  },

  updateMenuItemFields: async (id: string, fields: Partial<MenuItem>) => {
    const updated_at = new Date().toISOString();
    set((state) => ({
      rows: state.rows.map((row) =>
        row.item.id === id
          ? { ...row, item: { ...row.item, ...fields, updated_at } }
          : row,
      ),
    }));

    const supabase = createClient();
    await supabase
      .from("menu_items")
      .update({ ...fields, updated_at })
      .eq("id", id);
  },

  deleteMenuItem: async (id: string) => {
    set((state) => ({
      rows: state.rows.filter((row) => row.item.id !== id),
    }));

    const supabase = createClient();
    const { data: existingGroups } = await supabase
      .from("menu_item_option_groups")
      .select("id")
      .eq("menu_item_id", id);
    const existingIds = (existingGroups ?? []).map((g) => g.id);
    if (existingIds.length > 0) {
      await supabase
        .from("menu_item_options")
        .delete()
        .in("group_id", existingIds);
      await supabase
        .from("menu_item_option_groups")
        .delete()
        .eq("menu_item_id", id);
    }
    await supabase.from("menu_items").delete().eq("id", id);
  },
}));
