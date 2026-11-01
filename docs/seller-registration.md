# Đăng ký seller — đợt 2

`POST /api/seller/register` chạy trong Node.js, xác minh cookie session bằng
Supabase Auth, dùng `SellerServices.validateRegistration`, rồi ghi PostgreSQL bằng
`pg`. Cần header `Origin` cùng origin ứng dụng. Chưa nối UI.

## Cấu hình server

Giữ các biến Supabase Auth hiện có. Thêm biến server-only, không dùng tiền tố
`NEXT_PUBLIC_`, không đưa connection string vào client hoặc log:

```dotenv
DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME?sslmode=verify-full"
```

Dùng direct/pooler endpoint phù hợp môi trường; CA certificate theo nhà cung cấp
(có thể dùng sslrootcert trong URL). Helper luôn dùng verify-full, kể cả URL thiếu
sslmode; các chế độ require/prefer/verify-ca được nâng lên verify-full. Cấu hình
tắt TLS hoặc bỏ xác minh certificate bị từ chối. Thiếu biến/cấu hình không hợp lệ
trả 503 có kiểm soát.
Không cần chạy migration. Không có fallback qua hai request Supabase.

## Contract

```json
{
  "name": "Cơm sinh viên",
  "description": "Cơm trưa mỗi ngày",
  "location": "KTX A",
  "cash": true,
  "bank": false,
  "scheduleMode": "same",
  "openTime": "10:00",
  "closeTime": "14:00",
  "days": [{ "id": "mon", "enabled": true }]
}
```

Validation giữ quy tắc đợt 1. `owner_id`, `user_id`, `role` và các field ngoài
contract bị từ chối. Chủ sở hữu luôn từ Auth đã xác minh. `startClosed` nếu gửi
phải là boolean nhưng không quyết định trạng thái tạo quán.

Response 201 chỉ có `restaurant: {id, slug, operating_status}`, `role: "seller"`,
`paymentSelectionPersisted: false` và thông báo thanh toán chưa được lưu/áp dụng.
Không trả delivery_token. Không tạo tài khoản ngân hàng hoặc suy ra phương thức
thanh toán từ ngân hàng. Payload JSON lỗi/validation trả 400, session không hợp lệ
401, profile thiếu/inactive 403, sai role/slug xung đột sau retry 409.

## Transaction và đồng thời

Cùng một connection: BEGIN → SELECT user FOR UPDATE → kiểm tra active/student →
INSERT quán closed → UPDATE role có điều kiện, đúng một hàng → COMMIT.
Status quán bỏ khỏi INSERT để dùng default `active` trong schema repo.
Lỗi trước commit rollback, luôn release connection; rollback lỗi thì hủy connection.
Slug có tên bỏ dấu + UUID. Chỉ lỗi 23505 của `public.restaurants`, constraint
`restaurants_slug_key`, được thử tối đa ba transaction; mỗi lần khóa/kiểm tra lại user.

Không dùng Idempotency-Key. Request sau khi đã thành seller trả 409. Nếu phản hồi
commit bị mất, chưa thể tự phát lại kết quả; không tự retry lỗi commit/network.
Không thêm giới hạn số quán theo owner. Khóa user chỉ bảo vệ luồng chuyển role này.

## Giả định chưa xác minh trên DB thật

- Theo code repo, `public.users.id` bằng Supabase Auth UUID. ERD có `auth_uid`
  nhưng không dùng cột đó để tự thay đổi cách liên kết.
- Bảng/cột/default/constraint giống SQL repo. Kết nối có quyền SELECT FOR UPDATE
  users, INSERT restaurants, UPDATE users.role/updated_at; RLS/trigger không chặn.
  Nếu role kết nối vượt RLS, service vẫn tự kiểm tra user và owner.
- Tên unique constraint slug theo tên mặc định PostgreSQL của schema repo.
- `operating_hours` là jsonb nullable. Quy ước code mới: version=1,
  timezone=Asia/Ho_Chi_Minh, days={mon:{open,close},...}; same mở rộng từng ngày,
  daily giữ giờ riêng, later lưu SQL NULL. Không sửa lịch quán cũ.
- ERD ghi work_for_restaurant_id int nhưng repo là UUID; không đụng cột staff.

Không tạo/sửa schema, RLS, RPC hoặc migration. Chưa làm update quán, ngân hàng,
ảnh, QR, staff hoặc sửa checkout/Auth.

## Kiểm tra

```sh
node --test tests/seller-validation.test.mjs tests/seller-registration.test.mjs
```

Test dùng module thật với mock DB/Auth, không đọc .env hay kết nối DB. Mock kiểm
tra thứ tự lock/ghi/commit/rollback và release, không chứng minh khóa đồng thời,
quyền truy cập hoặc rollback trên PostgreSQL thật. Cần integration test trên môi
trường được cho phép trước khi khẳng định vận hành với DB thật.
