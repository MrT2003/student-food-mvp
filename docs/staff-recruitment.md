# QR tuyển staff và quyền staff — đợt 4B

Prompt 4B ưu tiên hơn question.md và thiết kế 4A: không pending, không seller duyệt
tuyển dụng. QR nhiều người dùng trong 300 giây; tham gia thành công không tiêu thụ
mã. Tạo lại có nonce mới, không gia hạn/thu hồi mã cũ. Đóng modal chỉ ẩn UI.
Quán inactive hoặc closed vẫn được tuyển. Chưa chuyển staff hoặc đổi chủ quán.

## Cấu hình

Giữ DATABASE_URL/server-only/TLS verify-full và Supabase Auth như các đợt trước.
Thêm khóa server-only riêng, ngẫu nhiên, ít nhất 32 byte:

```dotenv
STAFF_INVITATION_SECRET="REPLACE_WITH_A_RANDOM_SERVER_ONLY_KEY_AT_LEAST_32_BYTES"
```

Đây chỉ là placeholder, phải thay bằng khóa ngẫu nhiên riêng trong môi trường chạy.
Không dùng NEXT_PUBLIC_, không dùng lại service-role key, DB password hoặc khóa OAuth.
Local dùng `node scripts/check-seller-staff-env.mjs --configure-secret`: chỉ thêm khi
chưa có key, dùng randomBytes(32), kiểm tra .env.local đã được Git ignore và không
in giá trị. Không tự thay khóa đang có. Mọi instance dùng cùng secret và đồng hồ đồng bộ.
Đổi secret làm toàn bộ mã cũ không còn hợp lệ; không có thu hồi riêng từng token.
Thiếu/quá ngắn, placeholder nhận diện được hoặc chuỗi quá ít ký tự khác nhau trả
503 STAFF_TOKEN_CONFIGURATION_MISSING. Bộ lọc này không chứng minh entropy của một
khóa tùy ý; phải sinh khóa bằng công cụ mật mã. Import chức năng khác
không cần secret QR. Không lưu token/nonce vào DB, bộ nhớ process hoặc kho ngoài.

## Tạo QR — cho Triều tích hợp

`POST /api/seller/restaurants/[restaurantId]/staff-qr`, body `{}`.
Cần cookie session và header Origin cùng origin ứng dụng. UUID route được kiểm tra.
Origin được đối chiếu Host và scheme của request, không tin X-Forwarded-Host.
Reverse proxy phải chuyển tiếp đúng Host/scheme bên ngoài. Đã kiểm tra HTTP local
với Host 127.0.0.1 dù Next chuẩn hóa request.url sang localhost.
Chỉ seller active sở hữu đúng quán. Không nhận TTL, owner, role từ client.

Response 201, Cache-Control: no-store:

```json
{
  "restaurantId": "44444444-4444-4444-8444-444444444444",
  "token": "SIGNED_TOKEN",
  "expiresAt": "2026-10-25T10:05:00.000Z",
  "qrPayload": "{\"type\":\"studentfood.staff-invite\",\"version\":1,\"token\":\"SIGNED_TOKEN\"}",
  "qrImageDataUrl": "data:image/png;base64,PNG_DATA"
}
```

UI hiển thị PNG đã tạo cục bộ bằng qrcode; không gọi dịch vụ QR bên ngoài. Payload
QR là JSON, không phải link tới màn hình chưa tồn tại. Bộ quét trong app kiểm tra
type/version, trích token, rồi chủ động POST dưới đây. Không coi restaurantId hoặc
payload chưa xác minh là quyền đổi role. Không tự submit khi mở link/GET.

Token chứa purpose/version, restaurantId, issuedBy, iat, exp=iat+300 và nonce ngẫu
nhiên 32 byte mỗi lần. Ký HMAC-SHA256 cố định bằng node:crypto theo pattern Auth
đã có, có domain separation riêng. Server không nhận thuật toán từ client, kiểm
tra chữ ký bằng timingSafeEqual rồi kiểm tra cấu trúc/UUID/hạn dùng. Token có chữ
ký, không mã hóa; không đặt credential hoặc thông tin ngân hàng vào claims.

Countdown lấy từ expiresAt do server trả, không phải hạn do client chọn. API mới
không kéo dài hạn cũ. Không có endpoint revoke/consume/close.

## Student tham gia

`POST /api/staff/join`, cùng yêu cầu cookie/Origin, body chỉ gồm:

```json
{ "token": "SIGNED_TOKEN_FROM_SCANNER" }
```

Response 200:

```json
{
  "profile": {
    "id": "22222222-2222-4222-8222-222222222222",
    "role": "staff",
    "work_for_restaurant_id": "44444444-4444-4444-8444-444444444444"
  }
}
```

Xác minh token trước truy vấn DB. Một transaction/connection khóa seller phát hành
và user tham gia theo UUID tăng dần, rồi khóa quán; kiểm tra lại issuer active/seller
và owner hiện tại. Applicant phải active/student và work_for_restaurant_id IS NULL.
Hạn token được kiểm tra lại sau chờ khóa, ngay trước UPDATE đồng thời role, quán
và updated_at. UPDATE có điều kiện và đúng một hàng; lỗi rollback, luôn release.
Không dùng delivery_token/Auth session/OAuth token làm lời mời.

Nhiều student khác nhau dùng cùng token hợp lệ đều có thể tham gia. Hai quán cùng
nhận một student: chỉ thao tác hợp lệ đầu tiên được cập nhật; thao tác sau conflict.
Gọi lặp sau thành công không đổi dữ liệu, trả 409. Chưa trả thêm tên quán đang làm;
UI dùng profile hiện tại, không đưa thông tin user khác vào lỗi.

Sau thành công, Triều gọi getCurrentProfile() và cập nhật useAuthStore hoặc tải lại
trang. Ghi public.users không bảo đảm phát sinh onAuthStateChange. Không giữ role
student cũ để quyết định quyền. Nếu request mất phản hồi sau commit, tải profile
trước khi thử lại; không có idempotency/single-use token.

## Lỗi QR

- 400 VALIDATION_ERROR/INVALID_JSON/INVALID_STAFF_TOKEN.
- 401 UNAUTHORIZED; 403 FORBIDDEN (Origin), ACCOUNT_INACTIVE, PROFILE_NOT_FOUND,
  SELLER_REQUIRED hoặc ISSUER_NOT_ALLOWED.
- 404 RESTAURANT_NOT_FOUND: issuer không còn sở hữu quán/quán không tồn tại.
- 409 STAFF_ROLE_CONFLICT hoặc STAFF_MEMBERSHIP_CONFLICT: không chuyển quán/reset role.
- 410 STAFF_TOKEN_EXPIRED: tạo mã mới, không sửa hạn token.
- 503 thiếu/sai cấu hình; 500 STAFF_OPERATION_FAILED. Không trả/log lỗi DB/token thô.

## Staff mua hàng — có phụ thuộc DB chưa đáp ứng

Application guard assertPurchaseAccess cho active student/staff mua hàng của chính
UUID được xác minh. CartServices dùng guard cho đọc giỏ và mọi mutation RPC;
OrderServices.createOrder dùng guard rồi giữ nguyên RPC/payload/giá hiện có.
Không thêm checkout, không đổi tính giá, tồn kho, payment hoặc quyền sở hữu đơn.
Review cuối đã bỏ log/trả nguyên lỗi DB/RPC ở cart/order; giữ các thông báo nghiệp
vụ checkout đã biết, lỗi không biết dùng thông báo cố định. Không đổi RPC/payload.

**Blocker xác định trong repo:** services/order.service.ts gọi create_checkout_orders;
supabase/rpc/create_checkout_orders.sql chỉ kiểm tra role='student' (khoảng dòng 44),
nên staff bị ACCOUNT_NOT_ALLOWED nếu DB dùng đúng bản này. create_checkout_order.sql
có cho student/staff nhưng khác contract và còn chứa ALTER TABLE, không được đổi
caller/chạy SQL để né giới hạn. Không thay đổi cả hai RPC.

add_to_cart, update_cart_item_quantity, update_cart_item_options, delete_cart_item
được gọi từ CartServices nhưng chưa thấy đầy đủ định nghĩa quyền trong repo.
RLS đọc/ghi carts/orders cho staff cũng chưa xác minh. Không fallback pg/admin.

Đường UI hiện có: useCartStore re-export useStudentMockStore, OrderConfirmView gọi
checkoutCart → simulateCheckout; useOrders/useOrderDetail đọc mock store.
Mock checkout vốn nhận student/staff nhưng tài khoản fixture mặc định student.
Không sửa hoặc coi UI mock là bằng chứng đã nối DB thật; Triều tích hợp riêng.

## Staff/seller chấp nhận đơn

`POST /api/orders/[orderId]/accept`, body `{}`, cookie/Origin như trên.
Chỉ pending → accepted và accepted_at do server đặt; căn cứ schema có pending,
accepted/accepted_at và OrderTrackingView mô tả cửa hàng chấp nhận, bắt đầu chuẩn bị.
Không triển khai reject/complete/cancel hoặc sửa payment/giá vì chưa thuộc phạm vi.

OrderApprovalServices dùng **Supabase session client**, không admin/pg. Đọc hồ sơ
active; staff chỉ order.restaurant_id = work_for_restaurant_id, seller chỉ quán có
owner_id = UUID xác minh. UPDATE có điều kiện id/restaurant_id/pending để chỉ một
request thắng, không ghi đè đơn đã xử lý. Gọi lặp trả 409, không cập nhật lại timestamp.

Response 200 chỉ `{order:{id,restaurant_id,order_status:"accepted",accepted_at}}`.
400 validation; 401 auth; 403 không đủ quyền/RLS 42501; 404 đơn/quán không thấy hoặc
không thuộc quyền; 409 trạng thái đổi hoặc RLS không cho cập nhật hàng; 500 hệ thống.

**Chưa thể khẳng định chạy đầy đủ:** không có policy orders phù hợp trong SQL repo.
Session client tiếp tục chịu RLS/grants cho SELECT và UPDATE cả order_status,
accepted_at. RLS phải kiểm tra active/role/quán hiện tại tại UPDATE, không chỉ lúc
application precheck; nếu thiếu, chưa bảo đảm race đổi role/chuyển chủ giữa hai
request. Không tạo/sửa policy/RPC hay đường quyền cao để bỏ qua hạn chế đó.

## Giả định và kiểm thử tích hợp về sau

Đợt 4C đã gọi endpoint metadata Supabase chỉ đọc: Auth settings trả 200 nhưng REST
OpenAPI trả 401/API_KEY_INVALID. Không đọc được định nghĩa schema/RPC/RLS; chưa có
integration test nghiệp vụ thật. Xem [kết quả 4C](seller-staff-integration-4c.md).
users.id = Auth UUID theo code hiện có; các
cột/quan hệ/default/quyền phải đúng schema repo. question.md nói DB có staff và
work_for_restaurant_id, nhưng chưa là bằng chứng trực tiếp mọi policy/RPC phù hợp.
SQL gốc enum chưa có staff, generated types có; không tự sửa enum/schema.

Mock kiểm tra implementation HMAC/QR thật, Auth/DB mô phỏng; không chứng minh
khóa/transaction/RLS/TLS handshake trên DB. Chưa tạo tài khoản/data thử.

Đã được phép kiểm thử tích hợp, nhưng local hiện thiếu DATABASE_URL; REST key cần
được kiểm tra lại trong cấu hình riêng. Có thể tạo/dọn Auth users thủ công qua
Dashboard, không bắt buộc service-role key (hướng dẫn trong kết quả 4C).
Khi đủ kết nối: dùng tài khoản riêng seller, ít nhất hai
student và một tài khoản ngoài quyền trên môi trường được xác nhận; kiểm tra QR
tạo lại/hết hạn, dùng chung, hai quán tranh một student, profile sau join; kiểm tra
RLS/RPC mua hàng và duyệt đơn đúng/sai quán, hai lần accept, role/status đổi khi đang
duyệt. Đối chiếu dữ liệu trước/sau, chỉ dọn dữ liệu test đã xác định. Không tự chạy
kế hoạch này trên dữ liệu có sẵn của người khác; không sửa enum/policy/RPC để làm
test xanh. Đổi role chỉ áp dụng tài khoản thử có ghi nhận ID và kế hoạch dọn.
