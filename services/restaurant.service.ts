import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type { MenuItemDetail, RestaurantMenu, RestaurantServiceType } from "@/types/restaurant.types";
import { mockMenuItemDetails, mockMenuRouteAliases, mockRestaurants } from "@/lib/mocks/catalog.mock";
// import type { StudentService } from "@/types/student-service.types";

// Chỉ lấy các cột công khai, không trả owner_id hoặc delivery_token ra frontend.
const restaurantFields = "id, name, slug, description, location, avatar_url, status, operating_status, operating_hours";
const menuFields = `
  *,
  option_groups:menu_item_option_groups (
    *, options:menu_item_options (*)
  )
`;

// Dùng cookie của request hiện tại; quyền đọc vẫn chịu sự kiểm soát của RLS.
// Gắn Database để Supabase suy luận đúng kiểu dữ liệu và quan hệ lồng.
async function getDatabaseClient() {
  return await createClient() as SupabaseClient<Database>;
}

// Trả null nếu slug không tồn tại/không được phép xem; lỗi truy vấn phải được ném ra.
async function getPublicRestaurant(client: SupabaseClient<Database>, slug: string) {
  const { data, error } = await client.from("restaurants")
    .select(restaurantFields).eq("slug", slug).eq("status", "active").maybeSingle();
  if (error) throw new Error(`Không thể tải cửa hàng: ${error.message}`);
  return data;
}

// Lấy món và toàn bộ options trong cùng truy vấn, tránh gọi DB riêng cho từng món.
// Không lọc is_available: frontend cần biết món đang tạm hết để hiển thị trạng thái.
function publicMenuQuery(client: SupabaseClient<Database>, restaurantId: string) {
  return client.from("menu_items").select(menuFields)
    .eq("restaurant_id", restaurantId).eq("is_active", true);
}

// Loại các nhóm/options bị ẩn nhưng vẫn giữ món không có tùy chọn.
// Sắp xếp ID ổn định vì schema hiện chưa có cột thứ tự hiển thị cho options.
function mapPublicMenuItem(item: MenuItemDetail): MenuItemDetail {
  return {
    ...item,
    option_groups: item.option_groups.filter((group) => group.is_active)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => option.is_active)
          .sort((a, b) => a.id.localeCompare(b.id)),
      })),
  };
}

export const RestaurantService: RestaurantServiceType = {
  // Lấy danh sách quán active; quán tạm đóng vẫn được trả cùng operating_status.
  async listRestaurants() {
    const client = await getDatabaseClient();
    const { data, error } = await client.from("restaurants")
      .select(restaurantFields).eq("status", "active").order("name").order("id");
    if (error) throw new Error(`Không thể tải danh sách cửa hàng: ${error.message}`);
    return data ?? [];
  },

  // Tìm quán trước, sau đó lấy menu đúng quán và giữ cấu trúc { restaurant, items }.
  async getRestaurantMenu(slug) {
    const client = await getDatabaseClient();
    const restaurant = await getPublicRestaurant(client, slug);
    if (!restaurant) return null;

    const { data, error } = await publicMenuQuery(client, restaurant.id)
      .order("name").order("id");
    if (error) throw new Error(`Không thể tải thực đơn: ${error.message}`);
    return { restaurant, items: (data ?? []).map(mapPublicMenuItem) };
  },

  // Tìm trực tiếp một món theo UUID hoặc slug, luôn giới hạn trong đúng quán active.
  async getMenuItem(restaurantSlug, itemSlugOrId) {
    const client = await getDatabaseClient();
    const restaurant = await getPublicRestaurant(client, restaurantSlug);
    if (!restaurant) return null;

    // Không gửi slug thường vào cột UUID để tránh lỗi invalid input syntax của PostgreSQL.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemSlugOrId);
    if (isUuid) {
      const { data, error } = await publicMenuQuery(client, restaurant.id)
        .eq("id", itemSlugOrId).maybeSingle();
      if (error) throw new Error(`Không thể tải món ăn: ${error.message}`);
      if (data) return mapPublicMenuItem(data);
    }

    // Fallback này cũng hỗ trợ slug có hình thức giống UUID nhưng không phải ID món.
    const { data, error } = await publicMenuQuery(client, restaurant.id)
      .eq("slug", itemSlugOrId).maybeSingle();
    if (error) throw new Error(`Không thể tải món ăn: ${error.message}`);
    return data ? mapPublicMenuItem(data) : null;
  },
};

// 
// type RestaurantService = Pick<
//   StudentService,
//   "listRestaurants" | "getRestaurantMenu"
// > & {
//   getMenuItem(
//     restaurantSlug: string,
//     itemSlugOrId: string,
//   ): Promise<MenuItemDetail | null>;
// };


// function getPublicRestaurant(slug: string) {
//   return mockRestaurants.find(
//     (restaurant) => restaurant.slug === slug && restaurant.status === "active",
//   );
// }

// function getPublicMenuItems(restaurantId: string): MenuItemDetail[] {
//   return mockMenuItemDetails
//     .filter((item) => item.restaurant_id === restaurantId && item.is_active)
//     .map((item) => ({
//       ...item,
//       option_groups: item.option_groups
//         .filter((group) => group.is_active)
//         .map((group) => ({
//           ...group,
//           options: group.options.filter((option) => option.is_active),
//         })),
//     }));
// }

// export const RestaurantService: RestaurantService = {
//   async listRestaurants() {
//     const restaurants = mockRestaurants.filter(
//       (restaurant) => restaurant.status === "active",
//     );

//     // Trả bản sao để bên gọi không sửa trực tiếp fixture dùng chung.
//     return structuredClone(restaurants);
//   },

//   async getRestaurantMenu(slug) {
//     const restaurant = getPublicRestaurant(slug);

//     if (!restaurant) {
//       return null;
//     }

//     const result: RestaurantMenu = {
//       restaurant,
//       items: getPublicMenuItems(restaurant.id),
//     };

//     return structuredClone(result);
//   },

//   async getMenuItem(restaurantSlug, itemSlugOrId) {
//     const restaurant = getPublicRestaurant(restaurantSlug);

//     if (!restaurant) {
//       return null;
//     }

//     const items = getPublicMenuItems(restaurant.id);

//     // Hỗ trợ UUID hoặc slug mới.
//     let item = items.find(
//       (entry) => entry.id === itemSlugOrId || entry.slug === itemSlugOrId,
//     );

//     // Hỗ trợ URL cũ trong thời gian chuyển đổi.
//     // Luôn giới hạn alias trong đúng quán.
//     if (!item) {
//       const alias = mockMenuRouteAliases.find(
//         (entry) =>
//           entry.restaurant_id === restaurant.id &&
//           entry.legacy_slug === itemSlugOrId,
//       );

//       if (alias) {
//         item = items.find((entry) => entry.id === alias.menu_item_id);
//       }
//     }

//     return item ? structuredClone(item) : null;
//   },
// };
