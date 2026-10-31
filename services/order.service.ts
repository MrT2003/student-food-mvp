import { createClient } from "@/lib/supabase/client";
import { assertPurchaseAccess } from "@/lib/auth/purchase-access";
import type { CreateOrderInput, CreateOrderResponse, OrderedSummary } from "@/types/order.types";

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

		if (!input.restaurantPreferences || input.restaurantPreferences.length === 0) {
			throw new Error("Vui lòng chọn phương thức thanh toán cho từng cửa hàng !");
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
			p_restaurant_preferences: input.restaurantPreferences.map((pref) => ({
				restaurant_id: pref.restaurant_id,
				payment_method: pref.payment_method,
				customer_notes: pref.customer_notes?.trim() || null,
			})),
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
	},

	// N là số dòng món, không phải số đơn. Không gộp các lần đặt cùng món.
	async fetchOrdered(fetchItems: number): Promise<OrderedSummary[]> {
		if (!Number.isInteger(fetchItems) || fetchItems < 1 || fetchItems > 100) {
			throw new Error("Số món cần lấy phải là số nguyên từ 1 đến 100.");
		}
		const client = createClient();
		const { data: { user }, error: authError } = await client.auth.getUser();
		if (authError || !user) throw new Error("Vui lòng đăng nhập lại để xem món đã đặt.");
		// RPC tự lấy auth.uid(), giữ RLS và chỉ đọc trạng thái quán/món, chưa đọc options.
		const { data, error } = await client.rpc("fetch_ordered_items", { p_fetch_items: fetchItems });
		if (error) throw new Error("Không thể tải món đã đặt: " + error.message);
		if (!Array.isArray(data)) throw new Error("Dữ liệu món đã đặt không hợp lệ.");
		type RpcItem = Omit<OrderedSummary, "isDimmed" | "notices">;
		return (data as RpcItem[]).map((item) => {
			const notices: string[] = [];
			if (item.restaurantAvailability === "closed") notices.push("Quán tạm ngưng nhận đơn");
			if (item.restaurantAvailability === "unavailable") notices.push("Quán hiện không khả dụng");
			if (item.menuAvailability === "paused") notices.push("Món tạm ngưng phục vụ");
			if (item.menuAvailability === "unavailable") notices.push("Món hiện không còn khả dụng");
			// Làm mờ nhưng vẫn cho click xem lịch sử; giá null không được hiển thị thành 0đ.
			return { ...item, isDimmed: notices.length > 0, notices };
		});
	}
}
