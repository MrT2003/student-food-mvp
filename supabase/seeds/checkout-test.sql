-- Run manually in Supabase SQL Editor on your test project.
-- Replace OWNER_UUID with an existing active seller's public.users.id.
-- Does not create Auth users, carts, cart_items, orders or order_items.
-- The panel creates these through your existing add_to_cart/create_checkout_orders RPCs.
BEGIN;
DO $seed$
DECLARE
  v_owner uuid := 'OWNER_UUID';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_owner AND role = 'seller' AND status = 'active') THEN
    RAISE EXCEPTION 'Choose an existing active seller in public.users';
  END IF;
  INSERT INTO public.restaurants (id, owner_id, name, slug, location, status, operating_status) VALUES
  ('91000000-0000-4000-8000-000000000001', v_owner, '[TEST] Quán 1', 'checkout-test-restaurant-1', 'KTX test', 'active', 'open'),
  ('91000000-0000-4000-8000-000000000002', v_owner, '[TEST] Quán 2', 'checkout-test-restaurant-2', 'KTX test', 'active', 'open')
  ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, status=EXCLUDED.status, operating_status=EXCLUDED.operating_status;
END;
$seed$;

INSERT INTO public.menu_items (id, restaurant_id, name, slug, price, category, is_active, is_available) VALUES
('91000000-0000-4000-8000-000000000011', '91000000-0000-4000-8000-000000000001', 'Trà sữa test 1', 'checkout-test-milk-tea-1', 30000, 'Nước uống', true, true),
('91000000-0000-4000-8000-000000000012', '91000000-0000-4000-8000-000000000002', 'Trà sữa test 2', 'checkout-test-milk-tea-2', 40000, 'Nước uống', true, true)
ON CONFLICT (id) DO UPDATE SET price=EXCLUDED.price, is_active=true, is_available=true;

INSERT INTO public.menu_item_option_groups (id, menu_item_id, name, is_multiple, is_required, is_active) VALUES
('91000000-0000-4000-8000-000000000100', '91000000-0000-4000-8000-000000000011', 'Kích cỡ', false, true, true),
('91000000-0000-4000-8000-000000000101', '91000000-0000-4000-8000-000000000011', 'Topping', true, false, true),
('91000000-0000-4000-8000-000000000110', '91000000-0000-4000-8000-000000000012', 'Kích cỡ', false, true, true),
('91000000-0000-4000-8000-000000000111', '91000000-0000-4000-8000-000000000012', 'Topping', true, false, true)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, is_multiple=EXCLUDED.is_multiple, is_required=EXCLUDED.is_required, is_active=true;

INSERT INTO public.menu_item_options (id, group_id, option_name, additional_price, is_active) VALUES
('91000000-0000-4000-8000-000000001000', '91000000-0000-4000-8000-000000000100', 'Size M', 0, true),
('91000000-0000-4000-8000-000000001001', '91000000-0000-4000-8000-000000000100', 'Size L', 5000, true),
('91000000-0000-4000-8000-000000001002', '91000000-0000-4000-8000-000000000101', 'Trân châu', 5000, true),
('91000000-0000-4000-8000-000000001003', '91000000-0000-4000-8000-000000000101', 'Phô mai', 10000, true),
('91000000-0000-4000-8000-000000001010', '91000000-0000-4000-8000-000000000110', 'Size M', 0, true),
('91000000-0000-4000-8000-000000001011', '91000000-0000-4000-8000-000000000110', 'Size L', 5000, true),
('91000000-0000-4000-8000-000000001012', '91000000-0000-4000-8000-000000000111', 'Trân châu', 5000, true),
('91000000-0000-4000-8000-000000001013', '91000000-0000-4000-8000-000000000111', 'Phô mai', 10000, true)
ON CONFLICT (id) DO UPDATE SET option_name=EXCLUDED.option_name, additional_price=EXCLUDED.additional_price, is_active=true;
COMMIT;

-- Expected: restaurant 1 = 85000, restaurant 2 = 105000, total = 190000.
-- JSONB preserves array order; it does NOT preserve object-key order.
