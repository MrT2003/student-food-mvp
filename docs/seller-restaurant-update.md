# Seller cập nhật quán — đợt 3A

`PATCH /api/seller/restaurants/[restaurantId]`, Node.js runtime. Cần cookie
Supabase Auth hợp lệ và header Origin cùng origin ứng dụng. Dùng lại
Supabase session client hiện có; không cần DATABASE_URL, không thay đổi DB.

## Contract PATCH

Chỉ chấp nhận `name`, `description`, `location`, `schedule`, ít nhất một field.
Chuỗi bắt buộc không rỗng nếu gửi, không nhận null, trim sau khi kiểm tra độ dài
100/300/200 giống đăng ký. Field không gửi giữ nguyên; field lạ bị từ chối.

```http
PATCH /api/seller/restaurants/22222222-2222-4222-8222-222222222222
Origin: https://APP_HOST
Content-Type: application/json
```

```json
{
  "name": "Tên quán mới",
  "schedule": {
    "mode": "same",
    "dayIds": ["mon", "fri"],
    "openTime": "10:00",
    "closeTime": "14:00"
  }
}
```

Schedule dùng đúng cấu trúc output validation đợt 1:

- `same`: mode, dayIds (ngày mon–sun, không trùng, ít nhất một), openTime, closeTime.
- `daily`: mode, days gồm `{id, open, close}` cho từng ngày hoạt động, không trùng.
- `later`: chỉ `{ "mode": "later" }`, xóa lịch bằng SQL NULL.

Không nhận `schedule: null`, lịch thiếu field, giờ qua đêm hoặc nhiều khung giờ/ngày.
Giờ là HH:mm, mở trước đóng. Schedule được thay toàn bộ, không merge lịch cũ.
Không gửi schedule thì giữ nguyên JSON cũ, không tự đổi định dạng dữ liệu cũ.
same/daily lưu JSON version 1, timezone Asia/Ho_Chi_Minh và days mapping từng ngày
theo quy ước đã chốt đợt 2.

Response 200:

```json
{
  "restaurant": {
    "id": "22222222-2222-4222-8222-222222222222",
    "name": "Tên quán mới",
    "description": "Mô tả hiện tại",
    "location": "KTX A",
    "operating_hours": {
      "version": 1,
      "timezone": "Asia/Ho_Chi_Minh",
      "days": {
        "mon": { "open": "10:00", "close": "14:00" },
        "fri": { "open": "10:00", "close": "14:00" }
      }
    }
  }
}
```

## Quyền và nhất quán

Service validate UUID/body trước khi dùng SDK. Xác minh getUser/UUID, profile
active/seller, đọc quán theo id/owner_id, rồi một UPDATE cùng điều kiện id/owner_id.
Session client chịu RLS; policy phải kiểm tra quyền hiện tại ngay tại UPDATE để
bảo vệ race đổi quyền sau precheck. Các SELECT và UPDATE không phải một transaction.
Không dùng admin/pg khi policy chặn. Không thêm điều kiện status hoặc giới hạn số quán.

Cập nhật theo metadata quản lý cung cấp 2026-10-28: RLS thực tế đang tắt và quyền
bảng authenticated rộng. Các guard/filter application vẫn giữ, nhưng không bảo vệ
đường Data API/RPC trực tiếp hoặc race thay đổi quyền. Nhóm DB cần xử lý riêng;
không suy ra hệ thống an toàn chỉ vì PATCH ghi được.

Payload UPDATE chỉ lấy tên cột từ allowlist cố định.
updated_at do server đặt. Không sửa slug khi đổi tên; lịch không đổi
status/operating_status. Không trả delivery_token hoặc lỗi PostgreSQL thô.

400: JSON/UUID/validation lỗi; 401: session không hợp lệ; 403: Origin hoặc quyền
seller/RLS không hợp lệ; 404 chung: quán không tồn tại/không thuộc seller hoặc UPDATE
không thấy hàng; 500: lỗi hệ thống. Response không cache. Xem seller-supabase-migration.md.

## Giới hạn xác minh

Dựa trên ERD và schema repo: users.id = Auth UUID, owner_id tham chiếu users.id,
restaurants có các cột đang dùng và updated_at, operating_hours jsonb nullable.
ERD có auth_uid và work_for_restaurant_id int khác code; không sửa hoặc sử dụng
các khác biệt đó trong đợt này. Quyền kết nối, RLS, trigger và tương thích dữ liệu
lịch cũ chưa xác minh trên DB thật. Server vẫn kiểm tra role/owner khi kết nối vượt RLS.

Test gọi implementation thật với mock, không chứng minh khóa, rollback hoặc tác
động trigger trên PostgreSQL thật. Không kết nối/ghi DB thật trong đợt 3A.

```sh
node --test tests/seller-validation.test.mjs tests/seller-registration.test.mjs tests/seller-restaurant-update.test.mjs
```

Chưa làm tạo thêm quán, ngân hàng, thanh toán, upload ảnh, QR/staff, UI hoặc checkout.
