# Seller menu / topping — review and rollout


> **Bước cần thực hiện ngay để gỡ lỗi hiện tại:** trên đúng project Supabase, mở
> SQL Editor → New query, dán toàn bộ file `supabase/rpc/seller_menu_inspection.sql`
> và Run. Dòng tổng hợp cuối phải có `rpc_count=0`, `rpc_metadata=[]` trước triển khai.
> Nếu schema/quyền vẫn đúng metadata đã review và không có đối tượng lạ, mở query mới,
> dán toàn bộ file `supabase/migrations/202611060001_seller_menu.sql` (từ comment đầu
> đến `COMMIT;`) rồi Run bằng role quản trị DB được cấp (thường là postgres).
> Không chạy local_test hoặc rollback trên project thật trong quy trình này.
> Thành công thường là `Success. No rows returned`: đó là kết quả DDL, chưa phải bằng chứng
> UI đã lưu món. Chạy lại nguyên inspection: `rpc_count=1`,
> `rpc_contract_and_access_ok=true`;6phần tử `menu_permissions` đều có `can_read=true`,
> `schema_usage=true`, `any_direct_write=false`, `any_column_write=false`.
> Gửi dòng tổng hợp này và kết quả chạy migration (che thông tin nhạy cảm nếu có).
> Nếu migration lỗi, dừng, gửi mã/thông báo lỗi; không sửa quyền hoặc chạy tiếp từng đoạn.
> Không cần viết lại form hoặc restart server để tạo function.


Status: application implemented; SQL prepared, NOT applied or executed. No real uploads/DB writes.

## Contract
GET/POST /api/seller/restaurants/:restaurantId/menu; GET/PATCH .../menu/:itemId.
Session required on every operation; active seller owner only, including closed/inactive shops.
Staff rejected. All writes require same Origin. No pg/admin client.
GET {items:[menu item with option_groups/options]}, POST/PATCH {item: authoritative RPC row}.
POST full object: name,description (null or nonempty string),category,image_url (null or HTTPS),price,
is_active,is_available,groups. Groups: id,name,is_active,is_multiple,is_required,options.
Options: id,option_name,additional_price,is_active. IDs may identify new children; existing IDs
must belong to exactly that parent. No owner/restaurant/timestamps/slug in body.
PATCH full edit adds expected_updated_at (keep original string, not JS Date conversion).
PATCH flag: {expected_updated_at, is_available: false} OR {expected_updated_at,is_active:false}.
No DELETE endpoint. Xóa/Ẩn are identical soft-hide, recover with visibility control.

Limits shared in UI/application/SQL: 20 groups, 50 options/group, 128KiB raw API body;
SQL also limits JSONB text to 128KiB (formatting overhead can make its bound stricter).
These bound transaction work/body memory, not new catalog business categories.
Names 120/80 chars, description160, category80, image URL2048; prices 0..10,000,000,
at most two decimal places, no rounding of stored values. Image required by current create UI;
DB/API still support nullable image (legacy rows), matching nullable schema. Cloudinary 5MiB
JPEG/PNG/WebP check unchanged; upload is not part of DB transaction. No image deletion added.
Error {error:{code}}: validation400, unauth401, forbidden403, notfound404, stale/name409,
body413, missing RPC503. Unknown write response/timeout -> MENU_RESULT_UNKNOWN503;
read back list before another create. Never automatic mutation retry.

## Transaction / IDs / names
sf_manage_menu locks active seller user SHARE -> owned restaurant SHARE -> item UPDATE ->
groups by UUID UPDATE -> options by UUID UPDATE. Checkout supplied definition locks user,
restaurant,item,groups,options in compatible parent order. Cross-item checkout/multi-action
can still deadlock; abort is safe, no hidden retry. DB load/concurrency remains untested.
Version comparison occurs after item lock. Every write advances timestamp (at least1microsecond).
Old form captures its original timestamp once. Toggle writes only its flag and updated_at.
Slug server-generated menu-UUID, unchanged on edit; global unique collision aborts, no blind retry.
Existing child UUIDs retained. Omitted children become inactive, never DELETE.
Included inactive child is reactivated only by explicit is_active=true; UI recovery buttons
reuse original IDs. Item visibility alone never reactivates descendants.
Unique names include inactive rows: adding a new UUID with such a name returns409, use explicit
recovery or a distinct name. Case-insensitive trim validation; DB lower() index is final authority.
Rename swaps can hit immediate unique index: rollback everything and return conflict; no temporary
rename, no changing identity to bypass constraints. All original snapshots untouched.

## Apply order (DBA, not an app/build script)
1. Run supabase/rpc/seller_menu_inspection.sql READ ONLY; save exact ACLs. Verify metadata
   still matches supplied schema/indexes and sf_manage_menu name/signature is unused.
2. Review supabase/migrations/202611060001_seller_menu.sql in dedicated test DB first.
   Creates ONE function, owner postgres, empty search_path, authenticated EXECUTE only.
   Revokes direct DML/destructive and column grants only on three menu tables from
   PUBLIC/anon/authenticated. Preserves SELECT and existing RLS settings, touches no other table ACL.
   Recheck inherited grants with inspection query. Other memberships can retain permissions.
3. Run local SQL test with dedicated Auth test seller/shop fixtures. It rolls back its rows.
   psql -v seller_id=UUID -v restaurant_id=UUID -f supabase/rpc/seller_menu_local_test.sql
   It must run role authenticated, not only as postgres. Also test anon/staff/inactive/other owner,
   foreign child IDs and two-session same-version competition in test DB. No production testing.
4. Only after review/approval, apply migration to target DB and run inspection again. Notify
   external direct-DML menu callers that writes must switch to RPC. Catalog reads stay available.
5. Deploy/use application after RPC rollout; until then mutations fail503 clearly, no SDK fallback.

Rollback: supabase/rpc/seller_menu_rollback.sql drops only this function and restores previously
supplied broad anon/authenticated table ACL. Do NOT use if preflight differs: restore saved exact
ACL instead. It intentionally does not revert rows, timestamps, inactive flags or order history.
Restoring broad rights is unsafe and must be DBA-approved/coordinated with old app release.

## Trust dependencies / scope
RPC checks users.role/status and restaurants.owner_id. Existing broad writes to users/restaurants
can undermine those facts. Menu ACL changes DO NOT secure the entire DB; DBA must handle this
separately. No Auth/users/restaurants/cart/checkout/QR/orders RPC or ACL changes in this task.
Existing create_checkout references option_snapshot_price absent from provided metadata;
create_checkout_orders uses selected_options correctly. Neither is edited here.
Catalog filters active groups/options; cart and checkout reject inactive/missing selections.
Do not remove/rewrite cart choices to conceal topping changes.

## Validation and manual checks after rollout
Application tests use mocked Auth/SDK/fetch, not PostgreSQL rollback/concurrency proof.
No psql/docker available in task environment; SQL remains unexecuted. Browser layout/camera not tested.
1. Test seller, closed shop: create item with two groups and options; reload and verify UUIDs,
   cents, image URL, category and flags. Staff/other seller/anon calls forbidden.
2. Edit field/tree; remove one option, restore using explicit recovery, verify same ID.
   Reuse inactive name with NEW ID ->409 and full tree unchanged. Duplicate rename ->rollback.
3. Two tabs edit same version ->one succeeds, second409. Repeat toggle/edit/soft-hide races.
4. Toggle unavailable ->only flag/version differs. Soft-hide ->no physical row deletion;
   restore item visibility ->removed options stay inactive.
5. Put test item in own cart then deactivate selected option/item; cart/checkout must reject
   and never silently substitute options. Check student's catalog reflects flags.
6. Compare complete existing TEST order_items snapshots before/after edits: unchanged.
7. Simulate API/network failure, keep draft, no success navigation; unknown create requires list
   reconciliation. Switch account/shop during reads/writes: no previous-shop cache displayed.
8. Compare desktop/mobile markup and real browser widths. No real uploads/payments/messages
   without separate authorization; an uploaded-but-unsaved Cloudinary asset needs manual cleanup.

## Review tiếp theo
- Hướng dẫn triển khai từng bước, điều kiện dừng và kiểm thử thực tế: seller-menu-rollout.md.
- Phân biệt PGRST202 (không resolve RPC/cache) và42883 (undefined function/phụ thuộc).
- Unique23505 chỉ map tên nhóm/options khi đúng constraint; slug và conflict khác có mã riêng.
- Validation giá dùng so sánh exact với2chữ số thập phân, không chấp nhận số lẻ siêu nhỏ
  rồi bị SQL từ chối. Không sửa/làm tròn dữ liệu DB.
- Test sidebar cập nhật import real SVG/mobile-navigation presentation, giữ assertion context.
- Không có SQL runtime hoặc DB/browser integration trong lượt review.

## Kết quả review local mới nhất (2026-11-06)
-38test menu PASS,28test seller-access PASS (import presentation module thật cho sidebar).
-Toàn bộ npm test:730/730 PASS; script UI menu:4suite PASS.
-Scoped ESLint, TypeScript noEmit và build chuẩn PASS (39trang).
-SQL đã review tĩnh, chưa được chạy trên PostgreSQL local hoặc Supabase.
-Không coi mock/markup tests là bằng chứng rollback/khóa/ACL hoặc UI/API/DB thật.
