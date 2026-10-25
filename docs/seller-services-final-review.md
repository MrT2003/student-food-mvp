# Đối chiếu cuối Seller Services

Đã đọc toàn bộ DormitoryFood_Task_SellerServices.md và question.md trong Downloads,
AGENTS.md, implementation/route/type, form SellerRegistrationView, các test liên
quan và tài liệu các đợt. Quyết định mới nhất trong hội thoại ưu tiên hơn question.md:
không pending/duyệt tuyển dụng, QR nhiều người 300 giây, không chuyển quán, không
thu hồi khi đóng modal. Không kết nối Supabase/PostgreSQL hoặc đọc giá trị env trong
lượt này. Không thay DB/policy/RPC/UI/Git branch hoặc ghi đè thay đổi có sẵn.

## Kết luận

Task gốc đủ implementation backend theo phạm vi đã chốt: đăng ký tạo quán đầu tiên,
cập nhật thông tin được giao, ngân hàng và QR/join. Không suy rộng Insert/Update
thành endpoint seller tạo thêm nhiều quán. Cash/bank đã được chấp thuận hoãn lưu và
áp dụng, API nói rõ paymentSelectionPersisted=false. Ảnh/UI không thuộc phạm vi.

Yêu cầu bổ sung đủ phần application cho staff mua hàng của mình và seller/staff
accept pending đúng quán. Tuy nhiên chức năng staff checkout chưa hoàn thành xuyên
suốt theo SQL repo: create_checkout_orders chỉ nhận student. Đây là phụ thuộc đã
biết ngoài cấu hình/kết nối và test DB thật, không phải việc có thể bỏ qua. Không
đổi RPC caller, sửa SQL hoặc dùng quyền cao để né. Chưa kết luận DB triển khai dùng
đúng định nghĩa đó. RLS/grants/RPC cart và quyền orders hiện tại cũng chưa xác minh.

## Bảng đối chiếu

Các đường dẫn dưới đây tính từ gốc repository.

| Yêu cầu | File/hàm làm căn cứ | Test làm căn cứ | Trạng thái | Thiếu sót/phụ thuộc |
| --- | --- | --- | --- | --- |
| Export và convention/comment | services/seller.service.ts: SellerServices; services/zalo-provider.service.ts, zalo-account.service.ts là bản service Zalo hiện có | Các test import module thật, gọi SellerServices | Đủ implementation/local | Không có file zalo.service.ts ở checkout hiện tại; dùng object export, unknown validation, lỗi an toàn và comment flow theo service hiện có |
| Validation đăng ký | SellerServices.validateRegistration; components/features/seller/SellerRegistrationView.tsx; types/seller.types.ts | tests/seller-validation.test.mjs: required fields, kiểu runtime, giới hạn, same/daily/later, trường ngoài allowlist | Đủ/local | name/description/location không trắng, tối đa 100/300/200; cash/bank boolean ít nhất một true; scheduleMode bắt buộc; ngày/giờ theo mode. Ảnh không bắt buộc, chưa upload |
| Đăng ký, owner/session, closed và role | SellerServices.register; app/api/seller/register/route.ts | tests/seller-registration.test.mjs: owner session, parameter SQL, lặp/đồng thời mô phỏng, row count, slug retry, rollback/release | Đủ/local | Cùng connection, user FOR UPDATE rồi INSERT và conditional UPDATE; retry slug tối đa ba transaction sau rollback. Status dùng default repo active; cash/bank không lưu theo quyết định đã chốt |
| Cập nhật quán | SellerServices.updateRestaurant/validateRestaurantUpdate; app/api/seller/restaurants/[restaurantId]/route.ts | tests/seller-restaurant-update.test.mjs: owner, PATCH từng field, schedule, row count, lỗi transaction | Đủ/local | Chỉ name/description/location/schedule; omitted giữ nguyên; không đổi slug/status/operating_status. Không có yêu cầu cụ thể tạo thêm quán |
| Lịch | validateSchedule, validatePatchSchedule, operatingHours trong seller.service.ts | seller-validation, seller-registration, seller-restaurant-update | Đủ/local | JSON version1/timezone Asia/Ho_Chi_Minh/days; same mở rộng ngày, daily giờ riêng, later SQL NULL; không sửa lịch cũ; không hỗ trợ qua đêm/nhiều khung giờ |
| Insert/update ngân hàng | SellerServices.createRestaurantBank/updateRestaurantBank, writeRestaurantBank; banks routes/_handler | tests/seller-banks.test.mjs: string giữ số 0, bank thuộc quán, partial PATCH, demote default, đúng constraint, rollback | Đủ/local | bank_name/account_no/account_name bắt buộc khi POST; is_default tùy chọn false. Cho phép không có default; true bỏ default cũ cùng quán. Chỉ uq_restaurant_banks_account map409; không ảnh hưởng quán khác |
| Phát hành QR thật | SellerServices.createStaffInvitation; lib/seller/staff-token.ts; staff-qr route | tests/staff-recruitment.test.mjs: HMAC, PNG giải mã jsQR, nonce mới/hạn riêng, seller ownership | Đủ/local | Fixed SHA256, purpose/version, nonce32 byte, timingSafeEqual; secret riêng server-only. Kiểm tra seller active/owner, không lọc quán inactive/closed; không dùng delivery_token |
| Join student thành staff | SellerServices.joinStaff/staffTransaction; app/api/staff/join/route.ts | staff-recruitment: hai student cùng token, lặp, tranh hai quán mô phỏng, hết hạn sau lock, issuer/owner/role, rollback/release | Đủ/local | Lock users theo UUID tăng dần trước restaurant; recheck expiry, active/student/unassigned, owner/issuer khi ghi; conditional UPDATE role/work_for_restaurant_id/updated_at cùng một statement. Không consume token, không chuyển quán |
| Auth, Origin, lỗi an toàn | route auth.getUser; lib/http/request-origin.ts; lib/seller/staff-http.ts; lib/database/server.ts | request-origin, registration/update/banks/staff API mock, staff-order-access | Đủ application/local | Proxy cần giữ Host/scheme; không tin X-Forwarded-Host. Queries tham số/allowlist, response không delivery_token/credential/lỗi DB thô; TLS verify-full; pool lazy |
| Staff mua hàng của chính mình | lib/auth/purchase-access.ts; services/cart.service.ts; services/order.service.ts | tests/staff-order-access.test.mjs: self student/staff, user khác/inactive bị chặn, RPC/payload cũ và lỗi sanitize | Đủ application, còn phụ thuộc RPC | create_checkout_orders.sql:44 chỉ role=student; RPC cart không có đủ định nghĩa trong repo. Guard không thay thế RLS/ownership bên trong RPC |
| Accept đúng quán và pending | services/order-approval.service.ts; app/api/orders/[orderId]/accept/route.ts; schema orders và OrderTrackingView | staff-order-access: staff/seller đúng/sai quán, state lỗi, hai accept mô phỏng, RLS lỗi, response allowlist | Đủ application, phụ thuộc RLS | Session client, conditional pending→accepted và accepted_at. Policy cần bảo vệ active/role/owner/membership hiện tại ngay tại UPDATE, bao gồm race đổi quyền sau precheck; chưa có bằng chứng policy đáp ứng |
| UI/modal/bộ quét | docs/staff-recruitment.md; form đăng ký và checkout hiện tại vẫn có đường mock | Không có kiểm thử camera/UI | Ngoài phạm vi, Triều phụ trách | Nối APIs/services, hiển thị QR, đếm giờ, scan JSON token, refresh profile sau join; không thêm pending/thu hồi khi đóng modal |

## Lỗi application sửa trong lượt này

Mức vừa: cart/order còn log hoặc ném nguyên lỗi DB/RPC. Đã bỏ log lỗi thô và dùng
thông báo cố định cho lỗi không biết; giữ thông báo PRICE_MISMATCH, invalid owner,
quantity và unauthorized đã có. ACCOUNT_NOT_ALLOWED trả mã/thông báo cố định để
không che phụ thuộc checkout. Không đổi payload, giá, payment method, quyền hay
RPC caller. Sửa comment validation cũ vốn mô tả backend như chưa được triển khai.

Test mới thực sự gọi implementation, làm console.error ném lỗi nếu bị gọi,
mô phỏng lỗi query/RPC và kiểm tra thông báo an toàn; test các mã nghiệp vụ vẫn
được giữ. Không chỉ so sánh chuỗi source. Không phát hiện thiếu implementation
khác có căn cứ trong phạm vi đã giao.

## Kiểm chứng local

- 722/722 test liên quan đạt: request-origin, seller-validation, seller-registration,
  seller-restaurant-update, seller-banks, staff-recruitment, staff-order-access,
  restaurant-test-route. Validation đợt 1 giữ nguyên.
- ESLint code seller/staff/cart/order, API liên quan và test thay đổi đạt.
- npm run build đạt, gồm compile, TypeScript và tạo 29 trang. Không vô hiệu hóa
  kiểm tra. Tsc độc lập gần nhất cũng đạt; không cần chạy lặp sau build đã kiểm TS.
- Lint toàn repo không chạy lại; kết quả cũ có lỗi ngoài phạm vi (AddToCartBtn,
  test_restaurant/explore, script auth cũ, parser database.types.ts...). Không coi
  scoped lint đạt là toàn repo lint đạt. Route build useParams đã sửa ở lượt trước.
- git diff --check đạt. Không gọi database thật, không tạo dữ liệu/tài khoản, không
  chạy migration; mock không chứng minh row lock/rollback/TLS/RLS thật.

## Phần còn lại ngoài cấu hình và test DB thật

1. Người quản lý DB phải xác minh/giải quyết contract quyền staff trong RPC
   create_checkout_orders nếu DB dùng bản student-only của repo. Đây là công việc
   phụ thuộc chức năng chưa hoàn tất, không được tự thực hiện trong phạm vi này.
2. Cần xác minh quyền staff của RPC cart và RLS/grants orders/users, đặc biệt chống
   tự đổi role/quán và kiểm tra quyền tại UPDATE; không suy luận DB giống repo.
3. UI/bộ quét và kết nối các luồng UI đang mock do Triều thực hiện. Không tuyên bố
   camera/thanh toán thực tế/toàn hệ thống đã vận hành.

Không còn công việc application bắt buộc khác được xác định trong phạm vi đã
chốt. Hoãn cash/bank là quyết định được duyệt, không phải đã lưu/áp dụng thanh toán;
upload ảnh, GET/DELETE bank và tạo thêm quán chưa được giao trong phạm vi này.
