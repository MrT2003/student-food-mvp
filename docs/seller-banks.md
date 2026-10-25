# Seller thêm/sửa tài khoản ngân hàng — đợt 3B

Hai endpoint dùng Node.js runtime, cookie Supabase Auth và Origin cùng origin ứng
dụng. Dùng lại pg/DATABASE_URL và TLS verify-full đã review, không thay đổi schema.
Chưa có GET/DELETE, UI hoặc xác minh tài khoản qua dịch vụ ngoài.

## Contract

POST `/api/seller/restaurants/[restaurantId]/banks`:

```json
{
  "bank_name": "Ngân hàng mẫu",
  "account_no": "0012345678",
  "account_name": "NGUYEN VAN A",
  "is_default": true
}
```

Ba field chuỗi bắt buộc, không nhận null/number/chuỗi trắng, trim đầu/cuối.
account_no luôn là string, giữ số 0 đầu và các ký tự bên trong. Schema repo chỉ
ghi varchar không có giới hạn độ dài, không thêm maximum hoặc quy tắc từng ngân hàng.
is_default tùy chọn, mặc định false; không tự chọn tài khoản đầu tiên làm mặc định.

PATCH `/api/seller/restaurants/[restaurantId]/banks/[bankId]`:

```json
{ "account_name": "TEN CHU TAI KHOAN MOI", "is_default": false }
```

Ít nhất một field trong cùng allowlist; field không gửi giữ nguyên. is_default
phải là boolean nếu gửi. Từ chối mọi field khác, gồm id, restaurant_id, owner_id,
user_id, role và timestamp. restaurantId/bankId phải là UUID. ID do server sinh,
restaurant_id lấy từ route sau xác minh quyền; timestamp dùng default/now().

POST trả 201, PATCH trả 200, không cache. Ví dụ response:

```json
{
  "bank": {
    "id": "33333333-3333-4333-8333-333333333333",
    "restaurant_id": "22222222-2222-4222-8222-222222222222",
    "bank_name": "Ngân hàng mẫu",
    "account_no": "0012345678",
    "account_name": "NGUYEN VAN A",
    "is_default": true
  }
}
```

Chỉ trả tài khoản đích của seller đã được xác minh, không trả user/token/tài khoản
quán khác. Không log số tài khoản, payload hoặc lỗi DB thô.

## Quyền, mặc định và transaction

Danh tính từ auth.getUser(), giả định public.users.id bằng Auth UUID như code hiện
có. Mỗi thao tác dùng một connection: BEGIN → khóa user → kiểm tra active/seller →
khóa quán theo id/owner_id → với PATCH khóa bank theo id/restaurant_id → ghi → COMMIT.
Khóa quán tuần tự hóa thao tác cùng quán kể cả chưa có bank. Không kiểm tra số quán
của owner, không thêm điều kiện status quán. Kiểm tra quyền dù kết nối DB vượt RLS.

- is_default=true: bỏ mặc định cũ của chính quán (PATCH loại tài khoản đích), rồi
  ghi tài khoản đích trong cùng transaction. PATCH xác minh đích trước khi bỏ mặc định.
- is_default=false: chỉ tài khoản đích false, không tự chọn tài khoản khác.
- PATCH không gửi is_default: không sửa mặc định.
- Cho phép không có mặc định; yêu cầu tối đa một, không phải đúng một.

UPDATE đích luôn kèm id và restaurant_id; SET theo allowlist cố định, mọi giá trị
qua parameters. Kiểm tra đúng một hàng ghi. Lỗi rollback cả phần bỏ mặc định cũ;
luôn release connection, rollback lỗi thì hủy connection.

Schema repo có UNIQUE(restaurant_id, account_no) tên uq_restaurant_banks_account
và partial unique index uq_restaurant_banks_one_default. Chỉ lỗi 23505 đúng schema
public, bảng restaurant_banks và constraint tài khoản nói trên được trả 409.
Không UPSERT, không retry/xóa để xử lý trùng. Lỗi unique khác không bị coi là trùng
số tài khoản. Tài khoản cùng số ở hai quán khác nhau không bị cấm bởi contract.

400: JSON/UUID/validation lỗi; 401: chưa xác thực; 403: Origin hoặc hồ sơ/quyền
seller không hợp lệ; 404 chung cho quán không tồn tại/không thuộc seller, hoặc bank
không tồn tại/thuộc quán khác; 409: trùng tài khoản; 503: cấu hình; 500: lỗi hệ thống.

Thêm/sửa ngân hàng không đổi role, status/operating_status quán hoặc cấu hình thanh
toán. Việc lưu/áp dụng cash/bank vẫn hoãn theo đợt 2, không suy ra từ việc có ngân hàng.

## Giới hạn kiểm chứng

Giả định bảng/cột/default/constraint/index khớp ERD và SQL repo, kết nối đủ quyền,
RLS/trigger không chặn/đổi hành vi. Chưa xác minh trên DB thật; không tự tạo đối tượng
DB còn thiếu. Khác biệt ERD auth_uid/work_for_restaurant_id đã ghi ở các đợt trước,
không sửa trong đợt này. Không cần cấu hình mới ngoài DATABASE_URL đã có.

```sh
node --test tests/seller-validation.test.mjs tests/seller-registration.test.mjs tests/seller-restaurant-update.test.mjs tests/seller-banks.test.mjs
```

Test gọi implementation thật với mock Auth/DB, không mở socket hay đọc .env. Mock
chỉ kiểm tra điều phối và tình huống mô phỏng, chưa chứng minh khóa, unique index,
rollback hoặc TLS handshake trên PostgreSQL thật.
