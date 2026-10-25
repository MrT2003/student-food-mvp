import { createClient } from "@/lib/supabase/client";
import { CreateOrderInput, CreateOrderResponse } from "@/types/order.types";
import { assertPurchaseAccess } from "@/lib/auth/purchase-access";

export const OrderServices = {
	// Create order from the selected list of cart_items 
	// Automatically gather group by restaurants and delete or subtract 
	// corresponding quantity in a DB transaction 

	async createOrder(input: CreateOrderInput): Promise<CreateOrderResponse> {
		const supabaseBrowser = createClient();

		// Validate whether the input ís empty or not 
		// If empty then immediately return error  
		if (!input.items || input.items.length === 0) {
			throw new Error("Danh sách món hàng thanh toán không được trống !");
		}

		if (!input.deliveryAddress || input.deliveryAddress.trim() === '') {
			throw new Error("Vui lòng cung cấp địa chỉ giao hàng !");
		}

		const validSessionId = input.sessionCheckoutId?.trim() || null;
		if (!Number.isFinite(input.expectedTotal) || input.expectedTotal < 0 ||
			input.items.some(item => !Number.isFinite(item.expectedUnitPrice) || item.expectedUnitPrice < 0)) {
			throw new Error('Vui lòng tải giá giỏ hàng trước khi đặt hàng.');
		}

		// Create payload 
		const payload = {
			// Seperate information of each selected items 
			// from the input list of items 
			p_checkout_items: input.items.map((item) => ({
				cart_item_id: item.cartItemId,
				quantity: item.quantity,
				expected_unit_price: item.expectedUnitPrice,
			})),
			p_delivery_address: input.deliveryAddress.trim(),
			p_customer_notes: input.customerNotes?.trim(),
			p_payment_method: input.paymentMethod,
			p_expected_total: input.expectedTotal,
			p_checkout_session_id: validSessionId,
		};

		// Staff được phép ở application; RPC/RLS vẫn quyết định quyền thực thi thật.
		// SQL create_checkout_orders trong repo còn chặn staff; không đổi RPC hoặc fallback quyền cao.
		await assertPurchaseAccess(supabaseBrowser);
		const { data, error } = await supabaseBrowser.rpc('create_checkout_orders', payload);

		if (error) {
			if (error.message.includes('PRICE_MISMATCH')) {
				throw new Error('PRICE_MISMATCH: Giá đã thay đổi. Vui lòng tải lại giá và xác nhận trước khi đặt.');
			}
			// Chỉ chuyển mã nghiệp vụ đã biết; không log/trả lỗi DB thô.
			// Handle các mã lỗi nghiệp vụ ném ra từ SQL
			if (error.message.includes('SOME_ITEMS_NOT_FOUND_OR_INVALID_OWNER')) {
				throw new Error('Sản phẩm trong giỏ hàng không tồn tại hoặc đã bị thay đổi.');
			}
			if (error.message.includes('INVALID_QUANTITY_TO_BUY')) {
				throw new Error('Số lượng đặt mua vượt quá số lượng hiện có trong giỏ hàng.');
			}
			if (error.message.includes('UNAUTHORIZED')) {
				throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
			}

			if (error.message === 'ACCOUNT_NOT_ALLOWED') {
				throw new Error('ACCOUNT_NOT_ALLOWED: Tài khoản không được phép thanh toán.');
			}
			throw new Error('Tạo đơn hàng thất bại.');
		}
		return data as CreateOrderResponse
	}
}
