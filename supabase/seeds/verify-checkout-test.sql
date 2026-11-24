-- After checkout, replace SESSION_UUID with the UUID displayed in OrderTestPanel.
-- Run all statements together. This script only reads application tables.
BEGIN;
SELECT set_config('checkout_test.session_id', 'SESSION_UUID', true);

SELECT session_checkout_id,
       count(*) AS order_count,
       count(DISTINCT restaurant_id) AS restaurant_count,
       sum(total) AS grand_total
FROM public.orders
WHERE session_checkout_id = current_setting('checkout_test.session_id')::uuid
GROUP BY session_checkout_id;
-- Expected: 2 orders, 2 restaurants, grand_total 190000.

SELECT o.id, o.order_code, o.session_checkout_id, o.restaurant_id,
       o.student_id, o.order_status, o.payment_method, o.subtotal, o.total,
       count(oi.id) AS item_rows, sum(oi.quantity) AS portions
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
WHERE o.session_checkout_id = current_setting('checkout_test.session_id')::uuid
GROUP BY o.id
ORDER BY o.restaurant_id;
-- Expected: 2 rows; item_rows = 2 and portions = 2 for each restaurant.

SELECT oi.*
FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
WHERE o.session_checkout_id = current_setting('checkout_test.session_id')::uuid
ORDER BY o.restaurant_id, oi.id;
-- Inspect option_snapshot_price: names/prices must come from the database.

SELECT ci.*
FROM public.cart_items ci JOIN public.carts c ON c.id = ci.cart_id
WHERE c.student_id IN (
  SELECT student_id FROM public.orders
  WHERE session_checkout_id = current_setting('checkout_test.session_id')::uuid
) AND ci.menu_item_id IN (
  '91000000-0000-4000-8000-000000000011',
  '91000000-0000-4000-8000-000000000012'
);
-- Fresh test cart: zero rows after checkout. Preexisting quantity > 1: remaining quantity is old quantity - 1.
COMMIT;
