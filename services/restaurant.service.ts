import "server-only";
import { catalogTimer } from "@/lib/restaurant/timing";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type { MenuItemDetail, RestaurantMenu, RestaurantServiceType, RestaurantCatalog } from "@/types/restaurant.types";
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

export const RestaurantService: RestaurantServiceType & {
  getCatalog(): Promise<RestaurantCatalog[]>;
} = {
  // Hai luồng đọc theo lô thay vì 1 + 2N truy vấn. Chỉ trang chi tiết mới tải options.
  async getCatalog() {
    const done = catalogTimer("catalog.total");
    try {
      const clientDone = catalogTimer("catalog.client");
      const client = await getDatabaseClient();
      clientDone();

      // Phân trang theo lô để không âm thầm mất dữ liệu khi chạm giới hạn response Supabase.
      // Trả thứ tự ổn định; tiếp tục đến trang rỗng (không đoán cấu hình max_rows của DB).
      async function readBatches<T>(label: string, read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
        const rows: T[] = [];
        for (;;) {
          const batchDone = catalogTimer(label);
          const { data, error } = await read(rows.length, rows.length + 50);
          batchDone({ rows: data?.length ?? 0 });
          if (error) throw new Error(`Không thể tải catalog: ${error.message}`);
          if (!data?.length) return rows;
          rows.push(...data);
        }
      }

      // Độc lập nên đọc song song. Inner join ở query món chỉ lấy quán active có quyền xem.
      // Bước 1: Promise.all chờ cả hai danh sách; tại đây CHƯA ghép món vào quán.
      // restaurants nhận kết quả truy vấn thứ nhất, menuItems nhận kết quả thứ hai.
      const [restaurants, menuItems] = await Promise.all([
        readBatches("catalog.restaurants.batch", (from, to) => client.from("restaurants")
          .select(restaurantFields).eq("status", "active").order("name").order("id").range(from, to)),
        readBatches("catalog.items.batch", (from, to) => client.from("menu_items")
          .select("id, slug, name, price, image_url, category, is_active, is_available, restaurant_id, restaurant:restaurants!menu_items_restaurant_id_fkey!inner(id)")
          .eq("is_active", true).eq("restaurant.status", "active")
          .order("name").order("id").range(from, to)),
      ]);

      const mappingDone = catalogTimer("catalog.group");
      // Bước 2: Tạo bảng tra trong bộ nhớ server: restaurant_id -> danh sách món.
      // Ví dụ: "quan-A" -> [món 1, món 2], "quan-B" -> [món 3]. Không ghi vào DB.
      const grouped = new Map<string, RestaurantCatalog["items"]>();
      // Bỏ object restaurant phụ từ JOIN; giữ restaurant_id và các field của món.
      for (const { restaurant: _restaurant, ...item } of menuItems) {
        // Lấy mảng món của quán này; nếu chưa có thì khởi tạo mảng rỗng.
        const bucket = grouped.get(item.restaurant_id) ?? [];
        // Thêm món vào đúng quán rồi lưu mảng vào Map bằng restaurant_id làm khóa.
        bucket.push(item);
        grouped.set(item.restaurant_id, bucket);
      }
      // Bước 3: Đây là chỗ GHÉP hai danh sách: restaurant.id khớp item.restaurant_id.
      // Mỗi quán trở thành { restaurant: thông tin quán, items: các món thuộc quán }.
      // Quán không có món vẫn được giữ lại với items: [], không bị loại khỏi kết quả.
      const result = restaurants.map((restaurant) => ({ restaurant, items: grouped.get(restaurant.id) ?? [] }));
      mappingDone({ restaurants: restaurants.length, items: menuItems.length, optionsFetched: 0 });
      return result;
    } finally {
      done();
    }
  },
  
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
