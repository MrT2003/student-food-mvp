# Số liên hệ quán và link công khai

## Phạm vi và căn cứ

Types/schema trong repo không có cột số điện thoại quán; users.phone là tài khoản.
Form đăng ký không có số liên hệ quán: không bổ sung field bắt buộc hoặc sửa RPC đăng ký.
Cột đề xuất là public.restaurants.contact_phone (text nullable). Metadata bảng do
người dùng cung cấp ngày 2026-11-14 xác nhận chưa có cột số liên hệ phù hợp;
chưa có bằng chứng migration đã được áp dụng hoặc quyền/trigger hiện tại đã kiểm tra.
Application đã chuẩn bị đường đọc/ghi; chưa coi task số liên hệ chạy thật hoàn tất.
Nếu metadata có field khác phù hợp, dừng migration và map lại application để tái sử dụng.

API PATCH /api/seller/restaurants/[restaurantId] giữ Auth session, active seller,
Origin và owner filter. Chỉ gửi field dirty + updated_at; không sửa users/Auth/OTP.
contact_phone vắng mặt giữ nguyên, null/blank xóa, string trim giữ số 0 đầu.
Dùng format AuthServices hiện có: + tùy chọn và 9–15 chữ số ASCII. Không number.
Lỗi column 42703/PGRST204 trả 503 CONTACT_PHONE_UNAVAILABLE, không ghi bù.
Một UPDATE gồm các field gửi: lỗi thiếu cột không được ghi từng field riêng.

Seller access đọc số liên hệ bằng query riêng để schema cũ không làm hỏng avatar,
đóng/mở và thông tin quán. Column chưa có hoặc thiếu quyền SELECT → availability=false,
UI khóa riêng số liên hệ, không dùng users.phone hoặc dựng dữ liệu thành công.
Các lỗi DB khác vẫn là lỗi đọc, không bị nuốt thành dữ liệu mẫu.
Timeout/malformed response khi lưu số: chỉ GET seller access đối chiếu toàn bộ
field thông tin gửi (id/user/role/active), không retry PATCH. Không khớp thì báo chưa xác nhận.

## Link

UI hiện chỉ read-only slug; không cho sửa slug. Router thật:
app/(student)/restaurants/[slug]/page.tsx. RestaurantServices tìm theo slug và
status=active, không lọc operating_status=open. Giữ closed có link và inactive
bị quy tắc công khai hiện có giới hạn. Không thay slug khi đổi tên.
Helper shop-contract tạo một route segment encode từ slug đã lưu; thiếu/hỏng
slug thì không tạo link. Copy lấy origin của browser, không lưu URL domain vào DB.
Màn Shop và Overview dùng chung helper; không liên quan link delivery/demo khác.
Trang công khai hiện không có UI số liên hệ quán, nên không thêm nút gọi hoặc
lấy số tài khoản để công khai. Không sửa menu/topping, ngân hàng, đơn, QR.

## Metadata phải review trước SQL

Danh sách cột đã được người dùng cung cấp. Các SELECT sau phục vụ hậu kiểm hoặc
review trigger/quyền còn chưa xác minh, không đọc hàng dữ liệu người dùng:

```sql
SELECT column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='restaurants' ORDER BY ordinal_position;
SELECT t.tgname,pg_get_triggerdef(t.oid),pg_get_functiondef(t.tgfoid)
FROM pg_trigger t WHERE t.tgrelid='public.restaurants'::regclass AND NOT t.tgisinternal;
SELECT relrowsecurity,relforcerowsecurity,
 has_table_privilege('authenticated','public.restaurants','SELECT') AS can_select,
 has_table_privilege('authenticated','public.restaurants','UPDATE') AS can_update
FROM pg_class WHERE oid='public.restaurants'::regclass;
```

Nếu có cột số liên hệ phù hợp: không chạy migration, kiểm tra tên/type/quyền và
điều chỉnh mapping theo metadata. Nếu chưa có: DBA review trigger, quyền và SQL
supabase/migrations/202611140001_restaurant_contact_phone.sql. Chỉ áp dụng riêng
file đó sau khi đồng ý thiết kế cột; không chạy tất cả migrations. Script có
preflight, transaction và hậu kiểm metadata. Không thêm GRANT/RLS/RPC/index.
Chưa chạy SQL trên Supabase hoặc DB local trong lượt này.

SQL hoàn tác: supabase/rpc/restaurant_contact_phone_rollback.sql, chỉ dùng nếu cột
thực sự được tạo bởi migration này, chưa có caller khác phụ thuộc, đã rollback app.
Script từ chối drop nếu còn số liên hệ đã lưu. Không xóa dữ liệu để ép rollback;
backup/review riêng hoặc giữ cột. Không CASCADE. Migration không tự áp dụng từ repo.
RLS/quyền bảng rộng đã biết vẫn cần DBA xem riêng; không nới quyền để né lỗi.

## Kiểm thử thật sau metadata/triển khai

Dùng quán test đúng seller. Nhập số test có 0 đầu, Lưu; kiểm tra đúng restaurants.id,
refresh/đăng nhập lại giữ số. PATCH text-only giữ số; rỗng xóa thành NULL. Sai kiểu,
ngoài quyền bị từ chối và users.phone/Auth không đổi. Lỗi mạng phải đọc lại trước
thử lại; không biến nhiều request SDK thành transaction.
Copy link ở Shop/Overview phải có origin đang chạy và slug đúng; mở trực tiếp và
refresh tìm đúng quán. Closed vẫn xem theo quy tắc active; inactive giữ hành vi cũ.
Đổi account/quán không giữ link cũ. Avatar/lịch/đóng-mở/menu/orders không đổi.
Mock test không chứng minh ghi DB, clipboard browser, route/UI thật hoặc SQL chạy đúng.
