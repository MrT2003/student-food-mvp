> Bản chuẩn bị DB mới: xem [staff-qr-db-rollout.md](./staff-qr-db-rollout.md). Application đã gọi join_staff_qr bằng session; migration mới CHƯA ÁP DỤNG. Các mô tả chặn cố định/pg bên dưới là lịch sử.

# QR staff qua SDK và UI — trạng thái hiện tại

Chưa hoàn tất join ghi DB. Không tuyên bố luồng end-to-end hoạt động.

## Đường truy cập và contract

- /seller/shop: thay riêng card/modal tuyển nhân viên của SellerShopView bằng
  StaffRecruitment, dùng lại CSS dự án. Các phần shop khác vẫn là preview như trước.
  Card tự xác minh Auth, đọc danh sách restaurants(id,name) theo owner UUID thật;
  không dùng ID/name từ shop demo làm lời mời. Có chọn quán nếu sở hữu nhiều quán.
- API POST /api/seller/restaurants/[restaurantId]/staff-qr body {}: session Auth,
  active/seller/owner, không lọc trạng thái quán; ký HMAC và tạo PNG cục bộ.
  Response 201: restaurantId,token,expiresAt,qrPayload,qrImageDataUrl. no-store.
- Payload QR JSON {type:"studentfood.staff-invite",version:1,token:string}.
  Token không nằm trong URL, localStorage hoặc analytics. Mỗi mã hạn riêng 300 giây,
  nonce mới; đóng modal không thu hồi; tạo lại không sửa token cũ.
- /account/join-store: scanner hiện có nay dùng jsQR trên camera hoặc ảnh.
  Loại URL và payload không hỗ trợ; không navigation theo dữ liệu QR. Giới hạn file
  10MB, canvas ảnh tối đa2048px. Auth đọc trước khi mở camera; dọn track/frame khi
  đóng/unmount hoặc quét thành công; chặn frame trùng. Camera cần secure context
  (localhost hoặc HTTPS), quyền trình duyệt và thiết bị. Không tự tạo tunnel.
- Token được chuyển tạm trong bộ nhớ UI sang /account/join-store/confirm, không
  phải kho invitation/pending phía server. Reload/direct-link phải quét lại.
  Trang xác nhận không tự coi chữ ký hợp lệ hoặc báo pending/thành công giả.
- POST /api/staff/join body {token}: auth/Origin, validation/chữ ký/hạn, active/student/
  chưa thuộc quán, kiểm tra issuer và owner. Khi mọi precheck đạt hiện trả
  503 STAFF_JOIN_ATOMICITY_UNAVAILABLE TRƯỚC mọi mutation.
- Nếu sau này có implementation đủ điều kiện trả thành công, client chỉ chấp nhận
  allowlist profile{id,role,work_for_restaurant_id}, tải getCurrentProfile xác minh
  lại các field trước đồng bộ auth store và hiển thị thành công. Lỗi không tự retry;
  token tạm bị bỏ sau một lần gửi, hướng dẫn kiểm tra hồ sơ/quét lại.

## Cơ chế DB chưa xác minh

Một UPDATE có WHERE id/status/role/work_for_restaurant_id IS NULL bảo đảm nguyên tử
ba field student và cạnh tranh giành student, nhưng không đồng thời bảo vệ issuer,
owner và thời hạn sau chờ khóa DB. Không sử dụng các SELECT precheck rồi UPDATE để
khẳng định bảo đảm đầy đủ. Không có mutation, admin fallback, memory lock hoặc pg.

## Đối chiếu kết quả DB do người dùng cung cấp — 2026-10-31

Nguồn: kết quả SELECT/định nghĩa xuất từ Supabase do người dùng gửi, agent không
trực tiếp kết nối DB và không thực thi bất kỳ định nghĩa function nào.

Kết quả bộ lọc RPC trả6hàm: accept_order, add_staff_by_phone,
get_restaurant_orders, reject_order, remove_staff, set_restaurant_operating_status.
Không có RPC join QR phù hợp trong6định nghĩa này. Không suy rộng rằng toàn DB
không có cơ chế khác: truy vấn có bộ lọc và loại một số schema; trigger hiện chưa
có thân hàm trong kết quả được gửi.

add_staff_by_phone(varchar) là SECURITY DEFINER, owner postgres, search_path=''.
EXECUTE anon/authenticated/service_role=true; bên trong vẫn chặn auth.uid() NULL.
Caller phải là seller active, sở hữu quán ACTIVE; tìm quán theo auth.uid(), không
nhận restaurantId. Tìm target theo phone active, khóa target FOR UPDATE, kiểm tra
không tự tuyển và target.role=student rồi UPDATE role/work_for_restaurant_id/
updated_at cùng một statement. Lặp/cạnh tranh gán target được khóa/role-check bảo vệ.

Không dùng RPC này cho QR: caller QR là student; không được giả session seller,
nhận phone thay token hoặc dùng admin. RPC không xác minh chữ ký/purpose/version/
issuer/hạn/nonce của invitation; không định danh quán từ token; loại quán inactive
trái yêu cầu. SELECT quán không khóa và không kiểm tra lại owner/issuer sau khi
chờ khóa target. Nếu owner có nhiều quán, SELECT INTO không STRICT chọn một hàng
không có thứ tự xác định; không tự áp giới hạn một quán/chủ để né vấn đề.
remove_staff làm chiều ngược lại; các RPC đơn/trạng thái không cung cấp join.

Constraint chk_staff_restaurant_assignment yêu cầu staff có quán và role khác
staff phải NULL. Cùng FK fk_users_work_for_restaurant xác nhận assignment hợp lệ
về quan hệ nhưng không xác thực lời mời, owner, active hoặc thời hạn. Chính một
UPDATE ba field phù hợp constraint; constraint/FK không thay thế các kiểm tra
cross-row/khóa cần thiết. FK users.id -> auth.users(id) xác nhận liên kết UUID.
FK assignment ON DELETE SET NULL kết hợp CHECK có thể chặn xóa quán còn staff
(vì role vẫn staff nhưng FK muốn đặt NULL); đây là lưu ý vòng đời DB ngoài task,
không thay đổi hoặc thử xóa để kiểm chứng.

users/restaurants RLS=false, forced=false, authenticated SELECT/UPDATE=true và
không có policy trong kết quả gửi. Filter API không bảo vệ Data API trực tiếp;
constraint không kiểm tra auth.uid() hoặc owner. Đây là rủi ro quyền DB cần người
quản lý đánh giá, không thử khai thác hoặc tự thay RLS/GRANT.
Trigger users.sf_protect_contact_email đã có thân hàm do người dùng cung cấp:
protect_contact_email() LANGUAGE plpgsql SET search_path=''; không có SECURITY
DEFINER trong định nghĩa được gửi. Chỉ với current_user anon/authenticated, chặn
INSERT có contact_email/contact_email_verified_at hoặc UPDATE thay đổi hai cột đó,
bằng lỗi CONTACT_EMAIL_SERVER_MANAGED; các trường hợp còn lại RETURN NEW.
Không đọc/sửa role, work_for_restaurant_id hoặc updated_at; không xác minh token,
issuer, owner hay hạn và không khóa các hàng liên quan tuyển staff. Vì vậy trigger
này không bổ sung bảo đảm join đang thiếu, cũng không ngăn sửa role/assignment
qua Data API nếu quyền bảng cho phép và các constraint khác được đáp ứng.
Đây là đánh giá từ định nghĩa được cung cấp, chưa thử ghi/exploit trên DB thật.
Không còn yêu cầu đọc thêm thân trigger này. Chưa có cơ chế đã xác minh phù hợp
join QR; không suy rộng thành khẳng định mọi schema/function trong DB đều thiếu.

Join vẫn chặn trước mutation với STAFF_JOIN_ATOMICITY_UNAVAILABLE. Cơ chế cần
quản lý DB xác nhận/cung cấp phải dùng session student, xác thực invitation đáng
tin và chống gọi trực tiếp với restaurantId tự chọn, khóa/recheck student+issuer+
quán theo thứ tự ổn định, kiểm tra quyền và hạn sau chờ khóa, cập nhật đủ3field và
kiểm tra số hàng, nguyên tử khi lỗi, không consume token. Nếu chưa có cơ chế sẵn
có đáp ứng thì không thể mở đầy đủ join trong giới hạn cấm thay DB hiện tại.

## Cấu hình và kiểm tra

Hai API QR/join không còn cần DATABASE_URL, không import helper pg. Helper/package
chung vẫn được giữ. STAFF_INVITATION_SECRET là khóa riêng server-only ngẫu nhiên ít
nhất32byte, cấu hình trực tiếp môi trường bởi người vận hành; không in/gửi qua chat,
không đổi khóa cũ. Thiếu/placeholder/khóa không hợp lệ trả503 an toàn. Chỉ xem tên
biến/sample, không đọc env thật hoặc chạy script cấu hình env.

Local: 39 test tuyển staff/client/UI mới (30backend/token +9client/UI), gồm PNG giải
mã thật trong unit test, auth/owner, token, hết hạn với clock mock, blocked join
không ghi, request đồng thời blocked, stale modal, scanner track cleanup và profile
refresh. Các test điều phối transaction pg cũ được thay bằng contract SDK/blocked;
không dùng kết quả mock pg trước đây làm bằng chứng join mới hoạt động.
Toàn suite486 PASS, gồm54 Zalo; lint phần sửa và TypeScript PASS.
Build chuẩn npm run build PASS trên Next16.4.3, sinh34 trang.
Không có integration test ghi DB, OAuth hoặc camera thật trong lượt này.
Bốn request localhost ngoài sandbox đã có HTTP thật: QR/join không session đều401
UNAUTHORIZED; Origin ngoài đều403 FORBIDDEN. Chỉ xác minh các gate từ chối, chưa
kiểm tra phiên seller/student hoặc ghi DB. Không tự restart server.
Không tạo tài khoản/dữ liệu test: không có dữ liệu cần cleanup.

Sau khi cung cấp định nghĩa DB: đối chiếu trước khi nối mutation; rồi kiểm thử bằng
seller và hai student test, PNG/cùng token/token mới/hết300giây thực, role+quán+
updated_at qua đọc DB độc lập, cạnh tranh thực và cleanup đúng ID. Không yêu cầu
đăng nhập/camera khi join còn bị chặn; không lấy cookie/credential qua chat.
