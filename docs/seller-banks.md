# Seller quản lý ngân hàng qua Supabase session SDK

Trạng thái cập nhật: đọc/thêm/sửa một tài khoản đã có implementation và caller UI.
**Chuyển mặc định giữa hai tài khoản vẫn bị chặn trước ghi**, chưa có cơ chế DB
nguyên tử được xác minh. Không dùng pg, DATABASE_URL hoặc admin client.
Xem [báo cáo review](seller-bank-review.md) và [đề xuất SQL chưa áp dụng](seller-bank-default-proposal.sql).

## API và contract

- GET `/api/seller/restaurants/[restaurantId]/banks`: trả `{banks:[...]}`;
  đọc phân trang theo ID, chỉ quán thuộc active seller đã xác minh.
- POST cùng URL: ba chuỗi `bank_name`, `account_no`, `account_name` bắt buộc;
  `is_default` boolean tùy chọn, bỏ qua là false. Trả 201 `{bank:{...}}`.
- PATCH `/api/seller/restaurants/[restaurantId]/banks/[bankId]`: ít nhất một field
  cùng allowlist; field vắng mặt giữ nguyên. Trả 200 `{bank:{...}}`.

Chuỗi trim đầu/cuối, không rỗng/null/number. account_no luôn string, giữ số 0 đầu
và ký tự bên trong. Không áp giới hạn 6–19 chữ số hoặc tự đổi hoa tên chủ tài khoản.
Schema repo dùng varchar không ghi maximum. ID route phải UUID. Không nhận id,
restaurant_id, owner_id, role, timestamp trong body. Không UPSERT hoặc DELETE.

Response chỉ gồm id,restaurant_id,bank_name,account_no,account_name,is_default;
không log số tài khoản hoặc lỗi DB. Không cache. GET không yêu cầu Origin cho thao
 tác đọc; POST/PATCH bắt buộc cùng Origin và session được auth.getUser xác minh.
Service xác minh lại actor, profile active/seller, owner; PATCH kiểm tra bank thuộc
quán và UPDATE kèm id + restaurant_id. Không giới hạn status/operating_status quán.

## Default, lỗi và cạnh tranh

- PATCH không gửi is_default: giữ nguyên; false: chỉ bỏ default đích, không chọn lại.
- true khi không có default khác: một mutation; tối đa một default phụ thuộc partial
  unique index thực tế. Kết quả SELECT người dùng gửi 2026-11-01 xác nhận index
  uq_restaurant_banks_one_default đúng biểu thức và valid/ready=true; chưa test ghi thật.
- true khi có default khác: 503 BANK_DEFAULT_ATOMICITY_UNAVAILABLE, không ghi đích,
  không demote mặc định cũ. UI giữ nguyên dữ liệu và hiển thị lỗi.
- UNIQUE `(restaurant_id,account_no)` đã khớp metadata DB người dùng gửi, tên
  uq_restaurant_banks_account: chỉ đúng lỗi 23505 của constraint này được map 409
  BANK_ACCOUNT_CONFLICT. Partial index uq_restaurant_banks_one_default map 503.
  Unknown unique/error không bị báo nhầm là trùng tài khoản. Chưa test lỗi ghi live.
- Không có hàng UPDATE trả 404; INSERT không có hàng trả lỗi. RLS 42501 trả 403;
  các lỗi khác trả mã/thông báo an toàn, không lỗi PostgreSQL thô.

Các SELECT kiểm tra quyền + mutation SDK không phải transaction. RLS từng được
quản lý báo tắt/quyền bảng rộng: API owner filter không bảo vệ Data API trực tiếp
hoặc race role/ownership thay đổi sau precheck. Cần DBA xử lý riêng; không tự sửa.
Kết quả mới xác nhận quyền hiệu lực SELECT/INSERT/UPDATE mọi cột cho cả anon và
authenticated; file chỉ chứa result set cuối của nhóm SQL quyền, chưa có kết quả
RLS/schema USAGE/quyền bảng và policy mới. Không suy ra các kết quả bị thiếu.
Không có trigger không-internal trên bank và không có function khớp bộ lọc bank/
restaurant_banks được cung cấp; chưa có cơ chế chuyển default atomic được xác minh.

## Caller và giới hạn

`SellerPaymentView` lấy quán qua SellerAccessProvider và danh sách qua GET thật.
Form thêm/sửa gọi POST/PATCH, chỉ gửi field đã đổi, đọc lại danh sách sau success.
State không persist/cache chung giữa user; component key theo user + quán, client
kiểm tra identity trước/sau request, kết quả muộn sau unmount bị bỏ qua. Lỗi API
không báo lưu thành công. Lỗi mạng yêu cầu đọc lại trước gửi lại, không tự retry.

Cash/bank chưa lưu/áp dụng. Có tài khoản ngân hàng không có nghĩa chuyển khoản đã
bật. Không QR thanh toán, branch, xác minh tài khoản, chuyển tiền hoặc đối soát.
Không thêm xóa bank. Không dùng quán/tài khoản có sẵn của người khác để test.

Test service/API với Supabase mock và test component/helper thực tế nằm trong
seller-banks.test.mjs, seller-management.test.mjs. Chúng không chứng minh constraint,
RLS, trigger, transaction SQL đề xuất hoặc concurrency trên database thật.
