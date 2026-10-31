# Seller qua Supabase SDK — cập nhật 2026-10-28

## Kết quả hiện tại

Đăng ký đã gọi RPC register_seller bằng Supabase session client. Sửa quán và ngân
hàng một hàng đã dùng SDK. Không có DATABASE_URL/pg trong các đường gọi này; không
fallback pg/admin. QR/join staff giữ nguyên pg và secret riêng. Không sửa env thật,
SQL, migration, GRANT/policy/schema; không tạo tài khoản, ghi DB thật hay restart
server trong lượt này. Branch vẫn phong-seller-integration; không commit/push.

Định nghĩa và quyền DB dưới đây do người quản lý cung cấp qua hội thoại từ bản
xuất Supabase thật. Agent không tự truy vấn lại DB; không thực thi SQL định nghĩa.
Thông tin này thay trạng thái RPC chưa xác minh trong báo cáo trước.

| API | Cơ chế | Giới hạn |
| --- | --- | --- |
| POST /api/seller/register | Auth/validation/profile → một RPC register_seller → mapping response | Đã đủ implementation/local; chưa integration DB thật |
| PATCH /api/seller/restaurants/[restaurantId] | Session SDK UPDATE chỉ field gửi, id + owner_id | Active/seller/owner precheck; quyền DB rộng vẫn là rủi ro riêng |
| POST/PATCH banks | Session SDK, owner/bank precheck, một mutation | Chuyển default giữa hai tài khoản còn bị chặn trước ghi |
| POST staff-qr và POST /api/staff/join | Giữ pg transaction | Vẫn cần DATABASE_URL và STAFF_INVITATION_SECRET |
| POST orders/[orderId]/accept | Session SDK, unchanged | Không cần DATABASE_URL; chưa integration quyền thật trong lượt này |

## Đăng ký: RPC, PIN và response

SellerServices.validateRegistration nhận unknown; giữ name/description/location
không trắng, tối đa100/300/200, cash/bank boolean ít nhất một true và lịch cũ.
Thêm appLockPin bắt buộc: string đúng4 chữ số ASCII, không trim/chuyển number, giữ
số0 đầu. Không nhận owner/user/role/timestamp, avatar/upload hoặc PIN mặc định.

Form POST đúng contract, dùng password input cho PIN, không ghi client storage,
không tạo preview khi API lỗi. PIN chỉ ở state tạm và request tới API/RPC; xóa state
sau lần gửi. Không log/return PIN, không đưa giá trị PIN vào tài liệu/báo cáo. Không
thay cách RPC lưu PIN hoặc các chức năng App Lock khác.

Service nhận UUID đã xác minh và session client từ route; getUser kiểm tra lại
UUID, profile active/student. Gọi đúng một lần register_seller với:

- p_restaurant_name ← name đã validate/trim.
- p_description ← description; p_location ← location.
- p_operating_hours ← JSON version1/timezone Asia/Ho_Chi_Minh/days; later gửi null.
- p_app_lock_pin ← appLockPin nguyên chuỗi.
- Không gửi owner/role/userId; không gửi p_avatar_url (default NULL), chưa upload ảnh.

RPC dùng auth.uid(), khóa public.users FOR UPDATE, kiểm tra active/student và
owner đã có quán hay chưa; UPDATE role/PIN và INSERT restaurant cùng transaction.
Nếu INSERT lỗi, PostgreSQL hủy các thay đổi trong lời gọi RPC. Không gọi thêm
INSERT/UPDATE từ application, không ghi bù. Giới hạn owner đã có quán xuất phát
thân RPC do quản lý cung cấp, không phải giới hạn mới do application tự thêm.

RPC trả success, user.id/user.role và restaurant. Service xác minh user.id khớp
session, role seller, id/slug hợp lệ và operating_status closed. Response API vẫn
chỉ restaurant:{id,slug,operating_status}, role:seller, paymentSelectionPersisted:false
và thông báo thanh toán chưa lưu/áp dụng. Không trả toàn bộ JSON/RPC/PIN/token.

Các exception USER_NOT_FOUND/ACCOUNT_INACTIVE/UNAUTHORIZED map403/403/401;
ALREADY_SELLER/INVALID_ROLE/RESTAURANT_ALREADY_EXISTS map409 ROLE_CONFLICT;
VALIDATION_ERROR/INVALID_PIN map400 validation an toàn; đúng lỗi unique slug map409.
Thiếu RPC/signature PGRST202/42883 map503 REGISTRATION_RPC_UNAVAILABLE; quyền42501
map403. Lỗi mạng hoặc response sau RPC không xác định →503
REGISTRATION_RESULT_UNKNOWN, yêu cầu kiểm tra hồ sơ/quán trước khi gửi lại.
Không retry tự động hoặc compensation. Đã đọc SDK đang cài: RPC mặc định POST và
fetchWithRetry không retry POST; test dùng SDK thật với fetch mock xác nhận điều đó.

Slug do RPC cấp: lower/trim/lọc ASCII; thêm hậu tố khi phát hiện trùng, fallback
khi không còn ký tự. Khác helper pg cũ luôn thêm UUID. Không sửa tên quán để ép slug
hoặc sửa RPC. Hai user cùng tên có thể cùng qua EXISTS: unique constraint thực tế
mới quyết định; application trả lỗi slug khi nhận đúng23505, không khẳng định mọi
cạnh tranh đều được xử lý thành công. Chưa chạy concurrency trên DB thật.

Form chỉ chuyển /seller sau201 đúng contract và getCurrentProfile xác nhận seller
active, cập nhật useAuthStore. Lỗi sau commit không giả lập profile hoặc gửi lại
đăng ký. Các màn quản lý seller/checkout demo khác vẫn do Triều nối riêng.

## PATCH quán

Không dùng update_restaurant_profile cho PATCH: RPC đó ghi toàn bộ các field,
chỉ kiểm tra name và owner, thiếu active/seller. Không đọc snapshot cũ rồi ghi đè
qua RPC. Session SDK UPDATE chỉ name/description/location/schedule được gửi,
kèm id và owner_id, server đặt updated_at; không đổi slug/status/operating_status.
Same mở rộng từng ngày, daily giữ giờ riêng, later NULL; omitted giữ nguyên.
UPDATE không thấy hàng trả404; lỗi an toàn; response theo allowlist.

## Ngân hàng và phần còn chặn

POST cần bank_name/account_no/account_name string; account_no giữ số0 và ký tự
bên trong, không áp maximum ngoài schema. is_default bỏ qua thì false; PATCH ít
nhất một field, bỏ flag thì giữ nguyên, false không chọn thay thế. Kiểm tra session
active/seller, restaurant owner và bankId thuộc restaurantId; không UPSERT.

Mỗi thao tác chỉ một mutation; giữ constraint account/default theo schema repo.
Trùng uq_restaurant_banks_account trả409; default conflict trả503 riêng:

- Đặt true khi không có default khác: một mutation, unique index bảo vệ tranh
  chấp nếu thực sự có trên DB. Cho phép giữ true trên chính tài khoản đã default.
- Có default khác:503 BANK_DEFAULT_ATOMICITY_UNAVAILABLE trước ghi, không demote
  default cũ hoặc ghi đích. Không coi nhiều SDK request/Promise.all/ghi bù là transaction.

Truy vấn function do quản lý cung cấp chưa tìm thấy RPC bank theo bộ lọc đã chạy;
không kết luận cơ chế khác tên/schema chắc chắn không tồn tại. Nhóm DB cần cung
cấp định nghĩa/quyền một cơ chế nguyên tử cho chuyển default, kiểm tra owner và
bank thuộc quán, tuần tự hóa thao tác, bảo toàn default khi lỗi. Không tự tạo/sửa DB.

## Quyền DB và App Lock: rủi ro chưa được giải quyết

Theo metadata quản lý cung cấp, users/restaurants/restaurant_banks đều RLS=false,
forced=false, không có policy; authenticated có SELECT/INSERT/UPDATE rộng. Session
SDK không nâng quyền nhưng cũng không có RLS bảo vệ các bảng này lúc mutation.
Application vẫn kiểm tra getUser/active/role/owner; filter owner ở API không ngăn
client gọi Data API trực tiếp, tự sửa role/owner hoặc sửa dữ liệu ngoài quyền.
Nhiều SELECT rồi UPDATE không phải transaction; race đổi quyền sau precheck chưa
được chặn bằng cơ chế DB được xác minh. Không báo toàn hệ thống đã an toàn.

Hai RPC có EXECUTE cho anon/authenticated/service_role. register_seller chặn khi
auth.uid() NULL và kiểm tra active/student bên trong; anon EXECUTE không đồng nghĩa
đăng ký vô danh thành công. update_restaurant_profile lọc owner=auth.uid() nhưng
không kiểm tra active/role; không tương đương guard application. Validation DB của
register_seller yếu hơn API (không đầy đủ giới hạn/mô tả/location), nên gọi RPC trực
tiếp có thể bỏ qua validation application.

RPC gán trực tiếp PIN vào users.app_lock_pin; với SELECT bảng users rộng có rủi ro
lộ PIN. Đây là vấn đề lưu trữ/quyền DB/App Lock cần quản lý đánh giá riêng. Không
đổi cách lưu PIN, bật RLS, sửa GRANT/policy/RPC hoặc thử khai thác dữ liệu người khác.

## Cấu hình và kiểm thử local

SDK tái sử dụng NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY qua helper
server hiện có; SUPABASE_SERVICE_ROLE_KEY không phải danh tính gọi RPC đăng ký.
Không yêu cầu connection string cho ba luồng đã chuyển. Tên biến trong file mẫu
không chứng minh runtime hợp lệ. Không đọc/sửa env thật hoặc file mẫu đang có thay
đổi của user. Giữ pg/@types/pg/helper vì QR/join còn dùng; không hạ TLS/đổi secret.

Test gọi implementation service/API/form với Supabase mock theo định nghĩa RPC
được cung cấp, không mock một RPC tưởng tượng. Bao phủ PIN, lịch, Auth/profile,
request lặp/cạnh tranh mô phỏng, lỗi RPC sau precheck, rollback outcome mô phỏng,
response allowlist, network/commit không rõ, PATCH quán/bank, quyền/default và QR.
Mock không chứng minh SQL transaction/lock/RLS thật. Không có integration DB thật.

Kết quả local: 456/456 test liên quan đạt; scoped ESLint đạt; TypeScript toàn dự án
noEmit/incremental=false đạt; npm run build chuẩn đạt (compile/TypeScript/tạo35 trang).
git diff --check đạt. Không chạy lại toàn bộ lint ngoài phạm vi hoặc sửa/tắt kiểm
tra Auth/UI khác. Test SDK thật dùng fetch mock không phát sinh request mạng.

## Kiểm thử thật tiếp theo trên localhost:3000

1. User dùng tài khoản test riêng; đối chiếu Auth UUID với public.users.id,
   role=student và status=active. Ghi số quán của đúng owner trước thử. Không đổi
   role để giả lập đăng ký thành công. Nếu đã có quán, dùng tài khoản test khác.
2. Refresh /seller/register, nhập các field và PIN riêng trực tiếp vào ô password;
   không đưa PIN vào Console, ảnh, báo cáo hay chat. Các snippet cũ thiếu appLockPin
   không còn đủ contract. Gửi một lần; kiểm Network chỉ status/mã lỗi, không chia
   sẻ request body chứa PIN.
3. Mong đợi201 với role seller, quán closed, paymentSelectionPersisted=false. Đọc
   DB độc lập theo UUID/test ID: đúng owner, role seller, lịch same/daily đúng JSON
   hoặc later NULL, status active. Chỉ chọn cột cần thiết, không lấy app_lock_pin
   hay delivery_token để chụp/báo cáo. Refresh profile trên ứng dụng.
4. Đăng ký lặp trả409, không thêm quán. Nếu lỗi mạng/503 kết quả không rõ: xem
   profile/quán trước, không gửi lại mù. Mọi ca concurrency cần request đồng thời
   và session test tách biệt; chưa thực hiện trong lượt code này.
5. Sau đăng ký thành công mới kiểm PATCH quán và bank bằng test restaurantId;
   body theo docs/seller-restaurant-update.md và seller-banks.md. Chuyển default
   giữa hai tài khoản vẫn bị503 trước ghi, chưa được báo đạt.

Không restart server; thay source được Next dev nạp lại bình thường. Nếu server
không nhận source mới, người dùng chủ động quyết định restart, agent không tự làm.
