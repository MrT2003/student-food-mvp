import { createClient } from "@/lib/supabase/client";
import { CartUtilities, type SelectedGroup, type CompactSelectedGroup } from "@/utilities/cart_order.utility";

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

	// Add to cart function 
	async addToCart(input: AddToCartInput): Promise<CartItemResponse> {
		const supabase = createClient();

		// 1. Verify client session first, if user not yet login --> Throw error 
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			throw new Error("Please login to add this stuff to cart !");
		}

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
			console.error("Add to cart error:", error.message);
			throw new Error(error.message || "Cannot add product to cart.");
		}

		return data as CartItemResponse;
	},

	// Update cart_item quantity function 
	async updateQuantity(cartItemId: string, quantity: number): Promise<UpdateQuantityResult> {
		const supabase = createClient();
		const { data, error } = await supabase.rpc("update_cart_item_quantity", {
			p_cart_item_id: cartItemId,
			p_quantity: quantity,
		});

		if (error) throw new Error(error.message);
		return data as UpdateQuantityResult;
	},

	// Update cart_items options function 
	async updateOptions(cartItemId: string, newOptionHash: string, newSelectedOptions: SelectedGroup[], newQuantity: number): Promise<UpdateOptionsResult> {
		const supabase = createClient();
		const formattedOptions = CartUtilities.formatSortSelectedOptions(newSelectedOptions);

		const { data, error } = await supabase.rpc("update_cart_item_options", {
			p_cart_item_id: cartItemId,
			p_new_option_hash: newOptionHash,
			p_new_selected_options: formattedOptions,
			p_new_quantity: newQuantity,
		});

		if (error) throw new Error(error.message);
		return data as UpdateOptionsResult;
	},

	async deleteCartItem(cartItemId: string): Promise<DeleteCartItemResult> {
		const supabase = createClient();

		const { data, error } = await supabase.rpc("delete_cart_item", {
			p_cart_item_id: cartItemId,
		});

		if (error) {
			console.error("Lỗi xóa món khỏi giỏ hàng:", error.message);
			throw new Error(error.message || "Không thể xóa món khỏi giỏ hàng.");
		}

		return data as DeleteCartItemResult;
	},

};
