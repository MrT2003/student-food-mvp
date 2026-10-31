-- ============================================================================
-- SEED DỮ LIỆU MẪU TỪ lib/mocks/catalog.mock.ts LÊN SUPABASE
-- Cách dùng: Copy toàn bộ nội dung file này dán vào Supabase SQL Editor và bấm Run.
-- ============================================================================

BEGIN;

-- 1. Khôi phục / đồng bộ tài khoản từ auth.users sang public.users
--    (Giúp khắc phục luôn lỗi PROFILE_NOT_FOUND khi đăng nhập Google/Zalo sau khi xóa bảng users,
--     đồng thời lấy 1 user làm owner_id cho các quán mẫu)
INSERT INTO public.users (id, role, status, name, avatar_url)
SELECT
  au.id,
  'student'::public.user_role,
  'active',
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    split_part(au.email, '@', 1),
    'Người dùng'
  ),
  au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
ON CONFLICT (id) DO UPDATE
SET status = 'active',
    updated_at = now();

-- Nếu bảng auth.users đang hoàn toàn trống (chưa có bất kỳ tài khoản nào),
-- tạo 1 tài khoản owner mẫu trong auth.users và public.users để thỏa khóa ngoại owner_id.
DO $$
DECLARE
  v_owner_id uuid := '00000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users LIMIT 1) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      v_owner_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'owner-demo@studentfood.local',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Chủ Quán Demo"}'::jsonb,
      now(),
      now()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, role, status, name)
    VALUES (v_owner_id, 'restaurant_owner'::public.user_role, 'active', 'Chủ Quán Demo')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 2. Thêm 10 cửa hàng (restaurants) từ catalog.mock.ts
WITH default_owner AS (
  SELECT id AS owner_id FROM public.users ORDER BY created_at ASC LIMIT 1
)
INSERT INTO public.restaurants (
  id, owner_id, slug, name, location, description, status, operating_status
)
SELECT
  r.id::uuid,
  default_owner.owner_id,
  r.slug,
  r.name,
  r.location,
  r.description,
  'active',
  'open'
FROM default_owner
CROSS JOIN (
  VALUES
    ('10000000-0000-4000-8000-000000000001', 'com-co-ba',        'Cơm Cô Ba',        'KTX A', 'Cơm nhà, món Việt, giá sinh viên.'),
    ('10000000-0000-4000-8000-000000000002', 'tra-sua-nha-lam',  'Trà Sữa Nhà Làm',  'KTX B', 'Trà sữa và đồ uống.'),
    ('10000000-0000-4000-8000-000000000003', 'bun-cha-ha-noi',   'Bún Chả Hà Nội',   'KTX A', 'Bún chả và món Việt.'),
    ('10000000-0000-4000-8000-000000000004', 'mi-cay-seoul',     'Mì Cay Seoul',     'KTX B', 'Món Hàn và ăn vặt.'),
    ('10000000-0000-4000-8000-000000000005', 'an-vat-5k',        'Ăn Vặt 5K',        'KTX A', 'Ăn vặt và đồ chiên.'),
    ('10000000-0000-4000-8000-000000000006', 'com-tam-dem',      'Cơm Tấm Đêm',      'KTX B', 'Cơm tấm và món Việt.'),
    ('10000000-0000-4000-8000-000000000007', 'xien-que-mr-beo',  'Xiên Que Mr.Béo',  'KTX A', 'Ăn vặt và đồ nướng.'),
    ('10000000-0000-4000-8000-000000000008', 'banh-mi-3t',       'Bánh Mì 3T',       'KTX B', 'Bánh mì và ăn vặt.'),
    ('10000000-0000-4000-8000-000000000009', 'ga-ran-campus',    'Gà Rán Campus',    'KTX A', 'Gà rán và đồ chiên.'),
    ('10000000-0000-4000-8000-000000000010', 'banh-mi-sau',      'Bánh Mì Sáu',      'KTX A', 'Bánh mì và ăn vặt.')
) AS r(id, slug, name, location, description)
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    description = EXCLUDED.description,
    status = 'active',
    operating_status = 'open',
    updated_at = now();

-- 3. Thêm 22 món ăn (menu_items) từ catalog.mock.ts
INSERT INTO public.menu_items (
  id, restaurant_id, slug, name, description, price, category, is_active, is_available
)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'com-co-ba-com-ga-chien',               'Cơm gà chiên',          'Cơm gà chiên — món ăn trong thực đơn của quán.',          25000, 'Cơm',       true, true),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'com-co-ba-com-suon-nuong',             'Cơm sườn nướng',        'Cơm sườn nướng — món ăn trong thực đơn của quán.',        32000, 'Cơm',       true, true),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'com-co-ba-com-tam-bi-cha',             'Cơm tấm bì chả',        'Cơm tấm bì chả — món ăn trong thực đơn của quán.',        28000, 'Cơm',       true, true),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'com-co-ba-com-chien-trung',            'Cơm chiên trứng',       'Cơm chiên trứng — món ăn trong thực đơn của quán.',       25000, 'Cơm',       true, true),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'com-co-ba-com-thit-kho-tau',           'Cơm thịt kho tàu',      'Cơm thịt kho tàu — món ăn trong thực đơn của quán.',      30000, 'Cơm',       true, true),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'com-co-ba-canh-rong-bien',             'Canh rong biển',        'Canh rong biển — món ăn trong thực đơn của quán.',        15000, 'Món thêm',  true, true),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'com-co-ba-tra-dao-cam-sa',             'Trà đào cam sả',        'Trà đào cam sả — món ăn trong thực đơn của quán.',        18000, 'Nước uống', true, true),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 'com-co-ba-tra-sua-truyen-thong',       'Trà sữa truyền thống',  'Trà sữa truyền thống — món ăn trong thực đơn của quán.',  18000, 'Nước uống', true, true),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', 'com-co-ba-tra-tac',                    'Trà tắc',               'Trà tắc — món ăn trong thực đơn của quán.',               12000, 'Nước uống', true, true),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 'com-co-ba-khoai-tay-chien',            'Khoai tây chiên',       'Khoai tây chiên — món ăn trong thực đơn của quán.',       15000, 'Ăn vặt',    true, true),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'com-co-ba-com-ga-teriyaki',            'Cơm gà sốt teriyaki',   'Cơm gà sốt teriyaki — món ăn trong thực đơn của quán.',   25000, 'Cơm',       true, true),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000002', 'tra-sua-nha-lam-tra-sua-truyen-thong', 'Trà sữa truyền thống',  'Trà sữa truyền thống — món ăn trong thực đơn của quán.',  20000, 'Nước uống', true, true),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000002', 'tra-sua-nha-lam-tra-sua-tran-chau',    'Trà sữa trân châu',     'Trà sữa trân châu — món ăn trong thực đơn của quán.',     18000, 'Nước uống', true, true),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000002', 'tra-sua-nha-lam-tra-dao-cam-sa',       'Trà đào cam sả',        'Trà đào cam sả — món ăn trong thực đơn của quán.',        20000, 'Nước uống', true, true),
  ('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000003', 'bun-cha-ha-noi-bun-cha-dac-biet',      'Bún chả đặc biệt',      'Bún chả đặc biệt — món ăn trong thực đơn của quán.',      28000, 'Món chính', true, true),
  ('20000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000004', 'mi-cay-seoul-mi-cay-hai-san',          'Mì cay hải sản',        'Mì cay hải sản — món ăn trong thực đơn của quán.',        30000, 'Món chính', true, true),
  ('20000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000005', 'an-vat-5k-xien-que-thap-cam',          'Xiên que thập cẩm',     'Xiên que thập cẩm — món ăn trong thực đơn của quán.',     10000, 'Ăn vặt',    true, true),
  ('20000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000005', 'an-vat-5k-khoai-tay-chien',            'Khoai tây chiên',       'Khoai tây chiên — món ăn trong thực đơn của quán.',       15000, 'Ăn vặt',    true, true),
  ('20000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000005', 'an-vat-5k-banh-trang-tron',            'Bánh tráng trộn',       'Bánh tráng trộn — món ăn trong thực đơn của quán.',       15000, 'Ăn vặt',    true, true),
  ('20000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000006', 'com-tam-dem-com-tam-suon-nuong',       'Cơm tấm sườn nướng',    'Cơm tấm sườn nướng — món ăn trong thực đơn của quán.',    28000, 'Cơm',       true, true),
  ('20000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000008', 'banh-mi-3t-banh-mi-bo-nuong',          'Bánh mì bò nướng',      'Bánh mì bò nướng — món ăn trong thực đơn của quán.',      22000, 'Ăn vặt',    true, true),
  ('20000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000009', 'ga-ran-campus-ga-ran-campus',          'Gà rán Campus',         'Gà rán Campus — món ăn trong thực đơn của quán.',         26000, 'Ăn vặt',    true, true)
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    is_available = EXCLUDED.is_available,
    updated_at = now();

-- 4. Thêm các nhóm tùy chọn (menu_item_option_groups) từ catalog.mock.ts
INSERT INTO public.menu_item_option_groups (
  id, menu_item_id, name, is_required, is_multiple, is_active
)
VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000012', 'Topping thêm', false, true,  true),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000012', 'Mức đường',    true,  false, true),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000012', 'Mức đá',       true,  false, true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    is_required = EXCLUDED.is_required,
    is_multiple = EXCLUDED.is_multiple,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- 5. Thêm các tùy chọn chi tiết (menu_item_options) từ catalog.mock.ts
INSERT INTO public.menu_item_options (
  id, group_id, option_name, additional_price, is_active
)
VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Trân châu đen',  5000, true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'Thạch trái cây', 4000, true),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'Pudding',        6000, true),
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000002', '100% đường',        0, true),
  ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000002', '70% đường',         0, true),
  ('40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000002', '50% đường',         0, true),
  ('40000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000002', '30% đường',         0, true),
  ('40000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000002', '0% đường',          0, true),
  ('40000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000003', 'Bình thường',       0, true),
  ('40000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000003', 'Ít đá',             0, true),
  ('40000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000003', 'Không đá',          0, true)
ON CONFLICT (id) DO UPDATE
SET option_name = EXCLUDED.option_name,
    additional_price = EXCLUDED.additional_price,
    is_active = EXCLUDED.is_active,
    updated_at = now();

COMMIT;
