import type { OrderStatus, PaymentMethod } from "./order.types";

// DTO cho seller: không trả student_id, checkout/PIN/token hoặc cột thanh toán nội bộ.
export type SellerManagedOrder = {
  id: string;
  restaurant_id: string;
  order_code: string | null;
  order_status: OrderStatus;
  created_at: string;
  payment_method: PaymentMethod | null;
  subtotal: number | null;
  total: number | null;
  delivery_address: string | null;
  customer_notes: string | null;
  customer: { name: string | null; phone: string | null };
  order_items: {
    id: string;
    item_name_snapshot: string | null;
    unit_price_snapshot: number | null;
    // Theo SQL checkout/fetch_ordered_items: đơn giá/phần đã gồm options, không phải tổng dòng.
    total_price: number | null;
    quantity: number;
    image_url: string | null;
    selected_options: { group_name: string | null; option_name: string | null; additional_price: number | null }[] | null;
  }[];
};
