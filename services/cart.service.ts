import { createClient } from "@/lib/supabase/client";
import { SelectedGroup, CartUtilities } from "@/utilities/cart.utility"; // Import helper format đã viết ở turn trước

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
  selected_options: SelectedGroup[];
  created_at: string;
  updated_at: string;
}

export const CartServices = {
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
};