import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MenuError, menuUuid, validateMenu } from "@/lib/seller/menu-contract";
const fields = "id,restaurant_id,name,slug,description,price,image_url,category,is_active,is_available,created_at,updated_at,option_groups:menu_item_option_groups(id,menu_item_id,name,is_multiple,is_required,is_active,created_at,updated_at,options:menu_item_options(id,group_id,option_name,additional_price,is_active,created_at,updated_at))";
function menuResult(value: Record<string, unknown>): Record<string, unknown> {
  const pick = (row: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map(key => [key, row[key]]));
  const groups = Array.isArray(value.option_groups) ? value.option_groups : [];
  return { ...pick(value, ["id", "restaurant_id", "name", "slug", "description", "price", "image_url", "category", "is_active", "is_available", "created_at", "updated_at"]),
    option_groups: groups.map(g => ({ ...pick(g, ["id", "menu_item_id", "name", "is_multiple", "is_required", "is_active", "created_at", "updated_at"]),
      options: (Array.isArray(g.options) ? g.options : []).map((o: Record<string, unknown>) => pick(o, ["id", "group_id", "option_name", "additional_price", "is_active", "created_at", "updated_at"])) })) };
}
async function access(client: SupabaseClient, restaurant: unknown) {
  const id = menuUuid(restaurant);
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user) throw new MenuError("UNAUTHORIZED", 401);
  const profile = await client.from("users").select("role,status").eq("id", auth.data.user.id).maybeSingle();
  if (profile.error) throw new MenuError("MENU_READ_FAILED", 503);
  if (profile.data?.role !== "seller" || profile.data.status !== "active") throw new MenuError("MENU_FORBIDDEN", 403);
  const shop = await client.from("restaurants").select("id").eq("id", id).eq("owner_id", auth.data.user.id).maybeSingle();
  if (shop.error) throw new MenuError("MENU_READ_FAILED", 503);
  if (!shop.data) throw new MenuError("MENU_FORBIDDEN", 403);
  return id;
}
export const SellerMenuServices = {
  async read(client: SupabaseClient, restaurant: unknown, item?: unknown) {
    const id = await access(client, restaurant);
    const itemId = item === undefined ? undefined : menuUuid(item);
    const result: unknown[] = [];
    for (let offset = 0;;) {
      let query = client.from("menu_items").select(fields).eq("restaurant_id", id);
      if (itemId) query = query.eq("id", itemId);
      const { data, error } = await query.order("updated_at", { ascending: false }).order("id").range(offset, offset + 99);
      if (error || !Array.isArray(data)) throw new MenuError("MENU_READ_FAILED", 503);
      result.push(...data);
      if (!data.length) break;
      offset += data.length;
    }
    if (itemId && !result.length) throw new MenuError("MENU_NOT_FOUND", 404);
    return { items: result.map(row => menuResult(row as Record<string, unknown>)) };
  },
  async write(client: SupabaseClient, restaurant: unknown, item: unknown | undefined, input: unknown) {
    const itemId = item === undefined ? null : menuUuid(item);
    const { payload, expected } = validateMenu(input, itemId !== null);
    const id = await access(client, restaurant);
    // A single session RPC owns validation, locking, version checking and every write.
    // Never retry a mutation or fall back to separate SDK writes after an uncertain result.
    let response;
    try { response = await client.rpc("sf_manage_menu", { p_restaurant_id: id, p_item_id: itemId, p_expected_updated_at: expected ?? null, p_payload: payload }); }
    catch { throw new MenuError("MENU_RESULT_UNKNOWN", 503); }
    if (response.error) {
      const code = response.error.message;
      if (response.error.code === "PGRST202") throw new MenuError("MENU_RPC_UNAVAILABLE", 503);
      // 42883 can come from a dependency inside an existing function.
      if (response.error.code === "42883") throw new MenuError("MENU_RPC_DEPENDENCY_FAILED", 503);
      if (response.error.code === "23505") {
        if (/"uq_menu_item_option_(group_name|name)"/.test(code)) throw new MenuError("MENU_NAME_CONFLICT", 409);
        if (code.includes('"menu_items_slug_key"')) throw new MenuError("MENU_SLUG_CONFLICT", 409);
        throw new MenuError("MENU_WRITE_CONFLICT", 409);
      }
      if (["MENU_STALE", "MENU_NAME_CONFLICT"].includes(code)) throw new MenuError(code, 409);
      if (code === "MENU_FORBIDDEN" || response.error.code === "42501") throw new MenuError("MENU_FORBIDDEN", 403);
      if (code === "UNAUTHORIZED") throw new MenuError(code, 401);
      if (code === "MENU_NOT_FOUND") throw new MenuError(code, 404);
      if (code === "VALIDATION_ERROR") throw new MenuError(code);
      throw new MenuError("MENU_RESULT_UNKNOWN", 503);
    }
    const row = response.data?.item;
    if (!row || row.restaurant_id !== id || (itemId && row.id !== itemId) || typeof row.updated_at !== "string") throw new MenuError("MENU_RESULT_UNKNOWN", 503);
    return { item: menuResult(row) };
  },
};
