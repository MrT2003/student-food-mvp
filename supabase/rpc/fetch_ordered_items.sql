-- Chạy file này trong Supabase SQL Editor trước khi dùng fetchOrdered.
-- SECURITY INVOKER giữ nguyên RLS của người gọi, không dùng quyền admin để đọc catalog.
CREATE OR REPLACE FUNCTION public.fetch_ordered_items(p_fetch_items integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  IF p_fetch_items IS NULL OR p_fetch_items < 1 OR p_fetch_items > 100 THEN
    RAISE EXCEPTION 'FETCH_ITEMS_MUST_BE_BETWEEN_1_AND_100';
  END IF;

  -- LIMIT áp dụng cho từng dòng món, không phải số đơn và không gộp món trùng nhau.
  -- order_items không có created_at: dùng thời gian đơn cha và UUID để ổn định thứ tự.
  WITH recent AS MATERIALIZED (
    SELECT oi.id, oi.order_id, oi.menu_item_id, oi.item_name_snapshot,
      oi.image_url, oi.quantity, oi.unit_price_snapshot, oi.total_price,
      o.restaurant_id, o.order_code, o.order_status, o.created_at
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.student_id = v_user_id
    ORDER BY o.created_at DESC, o.id DESC, oi.id DESC
    LIMIT p_fetch_items
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'orderItemId', h.id,
    'orderId', h.order_id,
    'orderCode', h.order_code,
    'orderStatus', h.order_status,
    'createdAt', h.created_at,
    'restaurantId', h.restaurant_id,
    'restaurantName', r.name,
    'menuItemId', h.menu_item_id,
    'name', h.item_name_snapshot,
    'imageUrl', h.image_url,
    'quantity', h.quantity,
    'basePriceSnapshot', h.unit_price_snapshot,
    'unitPriceSnapshot', h.total_price,
    'lineTotalSnapshot', h.total_price * h.quantity,
    'restaurantAvailability', CASE
      WHEN r.id IS NULL THEN 'unavailable'
      WHEN r.status <> 'active' OR r.operating_status <> 'open' THEN 'closed'
      ELSE 'available' END,
    'menuAvailability', CASE
      WHEN m.id IS NULL THEN 'unavailable'
      WHEN NOT m.is_active OR NOT m.is_available THEN 'paused'
      ELSE 'available' END
  ) ORDER BY h.created_at DESC, h.order_id DESC, h.id DESC), '[]'::jsonb)
  INTO v_result
  FROM recent h
  -- LEFT JOIN giữ lịch sử khi quán/món đã xóa hoặc bị RLS ẩn.
  LEFT JOIN public.restaurants r ON r.id = h.restaurant_id
  LEFT JOIN public.menu_items m ON m.id = h.menu_item_id AND m.restaurant_id = h.restaurant_id;

  -- total_price NULL ở dữ liệu cũ được giữ nguyên, không giả định giá options bằng 0.
  -- Không đọc options catalog: bước đó chỉ thực hiện khi người dùng chọn Đặt lại.
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_ordered_items(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fetch_ordered_items(integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
