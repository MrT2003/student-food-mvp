import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { CartUtilities, type SelectedGroup, type CompactSelectedGroup } from "@/utilities/cart_order.utility";
import type { GetCartResult } from "@/types/cart.types";
import type { CartItem, CartRestaurant } from "@/lib/cart/view-model";
import { getCartSummary } from "@/lib/cart/calculations";
import { assertPurchaseAccess } from "@/lib/auth/purchase-access";

export interface AddToCartInput {
	menuItemId: string;
	restaurantId: string;
	optionHash: string;
	quantity: number;
	selectedOptions: SelectedGroup[];
}

export interface CartItemResponse {
	id: string;
	cart_id: string;
	menu_item_id: string;
	restaurant_id: string;
	option_hash: string;
	quantity: number;
	selected_options: CompactSelectedGroup[];
	created_at: string;
	updated_at: string;
}

// This result wil be used in Zustand to set up display data to the screen 
export type UpdateQuantityResult = | { status: "UPDATED"; item: CartItemResponse } | { status: "DELETED"; deletedCartItemId: string };

// This result wil be used in Zustand to set up display data to the screen 
export type UpdateOptionsResult = | { status: "UPDATED"; item: CartItemResponse } | { status: "MERGED"; deletedCartItemId: string; mergedItem: CartItemResponse };

export type DeleteCartItemResult = { status: "DELETED"; deletedCartItemId: string; };
// Define CartServices object
export const CartServices = {

	// Đọc giỏ và chuyển dữ liệu database sang các field hiển thị của frontend.
	async getCart(userId: string): Promise<GetCartResult> {
		// Client dùng chung chưa khai báo Database nên truy vấn join bị suy luận thành mảng.
		// Gắn schema cho truy vấn đọc này để Supabase hiểu quan hệ FK:
		// menu/restaurant là một object, còn option_groups/options là danh sách.
		// Giới hạn tại đây vì Database hiện chưa khai báo các RPC mà service khác đang dùng.
		const supabaseBrowserClient = createClient() as SupabaseClient<Database>;
		// userId từ UI không phải bằng chứng đăng nhập; RLS vẫn phải bảo vệ dữ liệu ở DB.
		const authenticatedUserId = await assertPurchaseAccess(supabaseBrowserClient, userId);

		// Một truy vấn lồng lấy cả giỏ, món, quán và catalog options, tránh gọi từng món.
		// Không dùng inner join: dữ liệu bị xóa/ẩn bởi RLS phải được phát hiện, không âm thầm mất dòng.
		const { data, error } = await supabaseBrowserClient.from("carts").select(`
			id, student_id, created_at, updated_at,
			cart_items (
				id, quantity, restaurant_id, selected_options, created_at,
				restaurant:restaurants!cart_items_restaurant_id_fkey (id, name, location, status, operating_status),
				menu:menu_items!fk_cart_item_menu_restaurant (
					id, name, price, category, is_active, is_available,
					option_groups:menu_item_option_groups (
						id, name, is_active, is_required, is_multiple,
						options:menu_item_options (id, option_name, additional_price, is_active)
					)
				)
			)
		`).eq("student_id", authenticatedUserId).maybeSingle();
		if (error) throw new Error("Không thể tải giỏ hàng. Vui lòng thử lại.");

		const restaurants = new Map<string, CartRestaurant>();
		// Sắp xếp ổn định để các dòng không nhảy vị trí sau mỗi lần tải lại.
		const rows = [...(data?.cart_items ?? [])].sort((a, b) =>
			a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
		const items: CartItem[] = rows.map((row) => {
			const { menu, restaurant } = row;
			if (!menu || !restaurant) throw new Error("Có món hoặc cửa hàng không còn truy cập được trong giỏ.");
			if (!menu.is_active  || !menu.is_available) throw new Error(`Món ${menu.name} hiện đã ngừng phục vụ. Vui lòng cập nhật giỏ hàng.`);
			if (!Number.isFinite(menu.price) || menu.price < 0) throw new Error(`Giá món ${menu.name} không hợp lệ.`);

			// JSONB chỉ chứa group_id + options[{id}]. Kiểm tra cấu trúc trước khi dùng.
			const selected = row.selected_options ?? [];
			if (!Array.isArray(selected)) throw new Error("Dữ liệu tùy chọn giỏ hàng không hợp lệ.");
			const extras: CartItem["extras"] = [];
			const seenGroups = new Set<string>();
			for (const selection of selected) {
				if (!selection || typeof selection !== "object" || Array.isArray(selection)
					|| typeof selection.group_id !== "string" || !Array.isArray(selection.options)
					|| seenGroups.has(selection.group_id)) throw new Error("Nhóm tùy chọn trong giỏ không hợp lệ.");
				seenGroups.add(selection.group_id);
				const group = menu.option_groups.find((g) => g.id === selection.group_id);
				if (!group?.is_active) throw new Error(`Tùy chọn của ${menu.name} đã thay đổi. Vui lòng chọn lại.`);
				if ((!group.is_multiple && selection.options.length > 1) || (group.is_required && !selection.options.length)) {
					throw new Error(`Vui lòng chọn lại nhóm ${group.name} của ${menu.name}.`);
				}
				const seenOptions = new Set<string>();
				for (const choice of selection.options) {
					if (!choice || typeof choice !== "object" || Array.isArray(choice)
						|| typeof choice.id !== "string" || seenOptions.has(choice.id)) throw new Error("Tùy chọn trong giỏ không hợp lệ.");
					seenOptions.add(choice.id);
					const option = group.options.find((o) => o.id === choice.id);
					if (!option?.is_active || !Number.isFinite(option.additional_price) || option.additional_price < 0) {
						throw new Error(`Tùy chọn của ${menu.name} không còn hợp lệ. Vui lòng chọn lại.`);
					}
					// Tên/giá luôn lấy từ catalog hiện tại, không lấy từ JSONB cũ.
					extras.push({ id: option.id, name: `${group.name}: ${option.option_name}`, price: option.additional_price });
				}
			}
			if (menu.option_groups.some((g) => g.is_active && g.is_required && !seenGroups.has(g.id))) {
				throw new Error(`Món ${menu.name} có tùy chọn bắt buộc mới. Vui lòng chọn lại.`);
			}
			const kind = menu.category === "Nước uống" ? "drink" : "food";
			restaurants.set(restaurant.id, {
				id: restaurant.id, name: restaurant.name, location: restaurant.location ?? "",
				isOpen: restaurant.status === "active" && restaurant.operating_status === "open",
				kind: restaurants.get(restaurant.id)?.kind === "food" || kind === "food" ? "food" : "drink",
			});
			return { id: row.id, restaurantId: row.restaurant_id, name: menu.name, basePrice: menu.price, quantity: row.quantity, extras, kind };
		});

		const restaurantList = [...restaurants.values()];
		const cart = data ? { id: data.id, student_id: data.student_id, created_at: data.created_at, updated_at: data.updated_at } : null;
		// Dùng chung phép tính với UI: (giá món gốc + tổng giá options) × số lượng.
		// Đây là giá dự kiến; RPC checkout vẫn phải xác thực lại giá và trạng thái tại lúc đặt.
		return { cart, items, restaurants: restaurantList, ...getCartSummary(items, restaurantList) };
	},

	// Add to cart function 
	async addToCart(input: AddToCartInput): Promise<CartItemResponse> {
		const supabase = createClient();

		// 1. Verify client session first, if user not yet login --> Throw error 
		await assertPurchaseAccess(supabase);

		// 2. Format and order selected_options properly before saving into DB
		const formattedOptions = CartUtilities.formatSortSelectedOptions(input.selectedOptions);

		// 3. Call RPC to execute insert into DB
		const { data, error } = await supabase.rpc("add_to_cart", {
			p_menu_item_id: input.menuItemId,
			p_restaurant_id: input.restaurantId,
			p_option_hash: input.optionHash || "NONE",
			p_quantity: input.quantity,
			p_selected_options: formattedOptions,
		});

		if (error) {
			// Không log/trả nội dung lỗi RPC có thể chứa dữ liệu truy vấn.
			throw new Error("Cannot add product to cart.");
		}

		return data as CartItemResponse;
	},

	// Update cart_item quantity function 
	async updateQuantity(cartItemId: string, quantity: number): Promise<UpdateQuantityResult> {
		const supabase = createClient();
		await assertPurchaseAccess(supabase);
		const { data, error } = await supabase.rpc("update_cart_item_quantity", {
			p_cart_item_id: cartItemId,
			p_quantity: quantity,
		});

		if (error) throw new Error("Không thể cập nhật số lượng trong giỏ hàng.");
		return data as UpdateQuantityResult;
	},

	// Update cart_items options function 
	async updateOptions(cartItemId: string, newOptionHash: string, newSelectedOptions: SelectedGroup[], newQuantity: number): Promise<UpdateOptionsResult> {
		const supabase = createClient();
		await assertPurchaseAccess(supabase);
		const formattedOptions = CartUtilities.formatSortSelectedOptions(newSelectedOptions);

		const { data, error } = await supabase.rpc("update_cart_item_options", {
			p_cart_item_id: cartItemId,
			p_new_option_hash: newOptionHash,
			p_new_selected_options: formattedOptions,
			p_new_quantity: newQuantity,
		});

		if (error) throw new Error("Không thể cập nhật tùy chọn trong giỏ hàng.");
		return data as UpdateOptionsResult;
	},

	async deleteCartItem(cartItemId: string): Promise<DeleteCartItemResult> {
		const supabase = createClient();
		await assertPurchaseAccess(supabase);

		const { data, error } = await supabase.rpc("delete_cart_item", {
			p_cart_item_id: cartItemId,
		});

		if (error) {
			throw new Error("Không thể xóa món khỏi giỏ hàng.");
		}

		return data as DeleteCartItemResult;
	},

};
