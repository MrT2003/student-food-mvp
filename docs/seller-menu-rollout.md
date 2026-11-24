# Triển khai và kiểm thử menu trên Supabase (bản review cuối)


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


Không có lệnh nào dưới đây đã được agent chạy trên Supabase. Không chạy toàn bộ migrations,
`supabase db push` hoặc seed của repository để triển khai riêng menu.

## 1. Xác nhận đúng project và preflight (chỉ đọc)
- Mở project Supabase nhóm đang dùng. Trong Settings / General kiểm tra Project ID với
  project ref được nhóm quản lý xác nhận. Không gửi key, cookie, mật khẩu hoặc env qua chat.
  `current_database()` thường là postgres, KHÔNG đủ xác định project.
- Mở SQL Editor và chạy TOÀN BỘ `supabase/rpc/seller_menu_inspection.sql`.
- Lưu kết quả ACL để rollback nếu cần. Metadata phải khớp ba bảng menu, FK và index đã review.
- Trước triển khai: truy vấn sf_manage_menu phải trả0 hàng (đã được người dùng xác nhận).
  Nếu có function mới/overload khác, DỪNG để đối chiếu; migration dùng CREATE, không ghi đè.
- PostgreSQL cần >=17 vì ACL hiện có MAINTAIN. Nếu khác phiên bản, dừng review cú pháp quyền.
- Các index unique tên phải còn áp dụng cả inactive. Giữ SELECT/USAGE hiện có cho anon/authenticated.
- Nếu quyền/RLS/column grants khác baseline đã cung cấp hoặc có grant thừa kế khác, dừng
  và để DBA đối chiếu; không dùng rollback baseline cho ACL khác.

## 2. Áp dụng đúng một migration (THAY ĐỔI DB, do bạn/DBA thực hiện sau review)
Ưu tiên chạy trên project thử có schema tương ứng và tài khoản Auth test riêng trước.
Mở `supabase/migrations/202611060001_seller_menu.sql`, copy TOÀN BỘ file vào một query
SQL Editor và chạy nguyên transaction BEGIN...COMMIT. Không ghép thêm SQL QR/cart/checkout.
- CREATE FUNCTION tạo public.sf_manage_menu(uuid,uuid,timestamptz,jsonb) RETURNS jsonb.
- Function kiểm auth.uid/active seller/owner, validation, version, khóa và ghi cây nguyên tử.
- ALTER OWNER postgres + SECURITY DEFINER + search_path rỗng; chỉ authenticated có EXECUTE
  từ quyền được cấp bởi migration (PUBLIC/anon bị revoke).
- REVOKE cuối file chỉ tác động DML/quyền phá dữ liệu/cột của đúng3bảng menu;
  giữ SELECT, không bật RLS hàng loạt, không đổi bảng users/restaurants.
- Nếu lỗi: không tiếp tục nhấn Lưu. Lưu mã/thông báo lỗi đã che dữ liệu nhạy cảm để sửa
  nguyên nhân. Không chạy từng đoạn còn lại sau lỗi hoặc cấp quyền rộng để chạy cho qua.
- Transaction lỗi phải rollback. Nếu SQL Editor báo transaction aborted, dùng chức năng
  kết thúc/rollback transaction của phiên đó trước khi chạy lại bộ migration đã sửa/review.

## 3. Hậu kiểm (chỉ đọc)
Chạy lại NGUYÊN FILE inspection:
- Một function ở public, đúng4tên tham số: p_restaurant_id,p_item_id,
  p_expected_updated_at,p_payload; kiểu uuid,uuid,timestamptz,jsonb; returns jsonb.
- Owner postgres, security_definer=true, proconfig có search_path="".
- authenticated_execute=true; anon_execute=false.
-6hàng quyền bảng: schema_usage/can_read=true, any_direct_write=false.
- Không còn quyền ghi cột trực tiếp qua PUBLIC/anon/authenticated.
Nếu quyền hiệu lực còn ghi được, DỪNG: grant thừa kế khác cần DBA xử lý có phạm vi.
Metadata không chứng minh API session thực tế hay rollback/cạnh tranh đã được thử.

## 4. Schema cache: chỉ xử lý khi function đã đúng nhưng API còn PGRST202
Đối chiếu đúng project, chữ ký và Exposed schemas có public trong cấu hình Data API.
Nếu khớp, DBA có thể chạy riêng `NOTIFY pgrst, 'reload schema';` trong SQL Editor để yêu cầu
PostgREST nạp lại cache, đợi rồi thử lại. Đây KHÔNG phải SELECT/chỉ đọc và KHÔNG tạo function;
không nằm trong file inspection. Agent chưa thực hiện lệnh này.
Lỗi42883 hiện trả MENU_RPC_DEPENDENCY_FAILED: đọc định nghĩa/hàm phụ thuộc để sửa đúng chỗ,
không mặc định tạo lại sf_manage_menu. Lỗi42501 trả MENU_FORBIDDEN, không fallback admin.

## 5. Kiểm thử bằng UI -> API -> DB sau khi triển khai
Không dùng dữ liệu người khác. Dùng seller test active sở hữu shop test (shop có thể closed).
1. Vào /seller/menu/new, nhập tên TEST MENU + mô tả/category/giá (có thể thử12.34), chọn ảnh
   test được phép upload, thêm nhóm required/single và topping. Nhấn Lưu một lần.
2. Network phải POST /api/seller/restaurants/<shop UUID>/menu ->200 {item:{id,...}}.
   Không chia sẻ payload/cookie. Ghi riêng UUID món và updated_at để đối chiếu, không sửa DB.
3. Refresh /seller/menu rồi mở edit: món và cây vẫn tồn tại. Dùng SELECT ở dưới để kiểm DB.
4. Sửa tên/giá/ảnh/category, bỏ một topping rồi lưu. UUID phần giữ lại không đổi, phần bỏ
   inactive. Khôi phục bằng nút có sẵn ->UUID cũ được dùng, không tạo UUID mới né unique.
5. Tạo nhóm/option mới có tên trùng inactive ->409, toàn bộ lần sửa không được lưu dở dang.
6. Toggle Còn/Hết món: chỉ is_available/updated_at thay đổi. Ẩn/hiện lại: chỉ is_active/version;
   nhóm/options đã bỏ không tự active trở lại, không DELETE vật lý.
7. Hai phiên edit mở từ cùng version: A lưu rồi B lưu ->B409 MENU_STALE. Đồng thời thật cần
   hai request đang cạnh tranh; gọi tuần tự không chứng minh khóa. Test cả edit/toggle/ẩn.
8. Staff, seller khác và chưa đăng nhập phải bị chặn. Chỉ thử trên các tài khoản/shop test
   riêng; kiểm quyền Data API trực tiếp bằng role test, không dùng admin làm danh tính nghiệp vụ.
9. Đối chiếu snapshot đơn test cũ không đổi. Chỉ kiểm đường đọc/validation student/cart đối với
   món/topping inactive; không tạo đơn, checkout hay thanh toán thật trong đợt này.
10. Lỗi mạng/RPC giữ draft, không success giả. Timeout tạo món: tải danh sách đối chiếu trước
    khi gửi tạo lại. Cloudinary upload riêng, ảnh có thể tồn tại dù transaction DB thất bại.

SELECT kiểm menu TEST (thay literal UUID bên dưới bằng UUID từ response của chính lần test):
```sql
SELECT id,restaurant_id,name,slug,price,image_url,category,is_active,is_available,updated_at
FROM public.menu_items WHERE id='UUID_MON_TEST'::uuid;
SELECT id,menu_item_id,name,is_required,is_multiple,is_active,updated_at
FROM public.menu_item_option_groups WHERE menu_item_id='UUID_MON_TEST'::uuid ORDER BY id;
SELECT o.id,o.group_id,o.option_name,o.additional_price,o.is_active,o.updated_at
FROM public.menu_item_options o JOIN public.menu_item_option_groups g ON g.id=o.group_id
WHERE g.menu_item_id='UUID_MON_TEST'::uuid ORDER BY o.group_id,o.id;
```
Các SELECT này chỉ dùng cho dữ liệu menu test của bạn, không lấy PIN/token/dữ liệu khách hàng.

## 6. File không phải bước mặc định
- seller_menu_local_test.sql: psql script có ghi trong transaction rồi ROLLBACK, chỉ chạy DB
  thử nghiệm riêng sau setup Auth test hợp lệ. Không paste nguyên vào SQL Editor vì có lệnh psql.
- seller_menu_rollback.sql: thay đổi định nghĩa/quyền, chỉ dùng khi DBA quyết định hoàn tác.
  Restores baseline ACL rộng (không an toàn), KHÔNG hoàn tác dữ liệu đã lưu, không xóa món.
- Không cần DATABASE_URL, admin/service-role hoặc restart server để tạo RPC qua SQL Editor.
  Lưu file SQL trong Git hoặc npm dev/build không tự triển khai function.

## Phụ thuộc ngoài phạm vi
Menu RPC tin users.role/status và restaurants.owner_id. Quyền ghi rộng vào hai bảng đó vẫn
cần DBA review riêng; menu migration không giải quyết toàn bộ bảo mật DB. Không thay các RPC
cart/checkout cũ. Chưa có PostgreSQL local, SQL runtime/locks/ACL/rollback và UI thật chưa được thử.
