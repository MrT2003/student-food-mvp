# Đóng / mở nhận đơn

## Contract

Tổng quan (desktop/mobile), checklist mở quán và màn Cửa hàng dùng
`openSellerRestaurant(actorId, restaurantId, target = "open")` →
`POST /api/seller/restaurants/[restaurantId]/open` →
`SellerServices.openRestaurant` → Supabase session RPC
`public.set_restaurant_operating_status(p_restaurant_id uuid, p_operating_status varchar)`.
Tên endpoint/helper cũ được giữ để tương thích caller mở quán.

Body chỉ `{ "operating_status": "open" }` hoặc `{ "operating_status": "closed" }`.
Đây là đích rõ ràng, không toggle. `paused` không được chuyển qua API này.
Không đổi `restaurants.status`, role, owner, lịch, menu hoặc hủy đơn đã có.
Không yêu cầu món/ảnh/ngân hàng để đóng hoặc mở (giữ quy tắc mở hiện có).

200: `{ restaurant: { id, operating_status }, alreadyOpen, alreadyAtTarget }`.
`alreadyOpen` giữ tương thích caller cũ; `alreadyAtTarget` dùng chung cả hai đích.
Nếu SELECT đã thấy đúng đích thì không gọi lại RPC hoặc cập nhật timestamp.

## Auth và đường ghi

API kiểm tra Origin, getUser, payload/UUID; service xác minh Auth actor,
profile active/seller và quán theo id + owner_id. Staff không được dùng API này.
Một RPC session thực hiện UPDATE; không admin, pg, ghi bù hoặc retry mutation.
Chỉ operating_status và updated_at được RPC ghi.

Căn cứ thân RPC: bản xuất Supabase người dùng cung cấp tại attachment
6e1e717e-03c3-4a94-8e76-379dc8b27ab3. RPC hỗ trợ open/paused/closed,
UPDATE theo id và owner=auth.uid() hoặc staff active được phân công;
trả success + operating_status, NOT_ALLOWED khi không có hàng phù hợp.
Theo bản định nghĩa cũ đã cung cấp, chưa thấy cần sửa SQL. Điều này không
chứng minh function đang triển khai hôm nay có cùng contract; cần kiểm tra lại
metadata khi có lỗi thực tế, không kết luận RPC đã đúng chỉ từ mock/local SQL.
Chưa đọc lại DB đang triển khai hoặc chạy mutation thật trong lượt này.

Giới hạn: RPC không có CAS theo trạng thái nguồn, owner branch không kiểm tra
active/seller; các kiểm tra đó nằm tại API trước RPC. Các request khác đích có
thể ghi đè trạng thái theo thứ tự UPDATE tại DB. Không tuyên bố khóa xuyên suốt
precheck–write hoặc ngăn mọi race đổi role/status. RLS/quyền ghi trực tiếp rộng
đã biết vẫn cần DBA đánh giá riêng; task không thay quyền DB.

## Lỗi, đọc lại và UI

401 session; 403 quyền/active/role; 404 không có quán thuộc actor;
400 payload/UUID/JSON; 409 paused. Mã RESTAURANT_OPEN_* cũ giữ tương thích,
hiện áp dụng cho cả hai đích. RPC thiếu/sai chữ ký:503;
lỗi mạng/phản hồi không xác định:503 RESULT_UNKNOWN; lỗi DB khác:500.
Không log/trả lỗi DB thô hoặc dữ liệu nhạy cảm.

Client GET seller access trước mỗi lần gửi, và đọc lại sau thành công hoặc
kết quả chưa rõ do timeout/parse/network. Không tự POST lại. Chỉ xác nhận khi
GET cùng actor/quán cho thấy đúng trạng thái đích. Khi khác đích, invalidate
context để hiển thị trạng thái mới rồi báo cần đối chiếu trước khi thử lại.
Lỗi quyền/RPC xác định không được biến thành thông báo thành công.

Context seller access là nguồn sự thật; không tạo store trạng thái song song.
Invalidate giữ nội dung cùng identity mounted, không xóa danh sách đơn.
Control pending dùng ref chặn double click; response trễ bị chặn theo identity
và vòng đời component. Checklist mở quán chỉ hoàn thành khi context là open.
Quán closed/inactive vẫn được quản lý bởi seller sở hữu theo seller access.

## Student và checkout

RestaurantServices trả operating_status, RestaurantView dùng isOpen;
CartServices chỉ isOpen khi status=active và operating_status=open.
`supabase/rpc/create_checkout_orders.sql` kiểm tra cả hai tại backend;
`fetch_ordered_items.sql` đánh dấu quán đóng. Đây là SQL trong repo,
chưa phải bằng chứng bản RPC hiện triển khai trên Supabase giống hệt.
Không sửa checkout hoặc dữ liệu đơn hiện có.

## Kiểm thử và hậu kiểm thủ công

Test service/API/client/component thật với mock SDK/Auth/fetch:
closed→open, open→closed, lặp đích no-op, nhiều vòng đóng/mở, quyền,
payload ngoài contract, paused, readback, timeout/response trễ và nhấn đồng thời.
Mock không chứng minh SQL/RLS/transaction/concurrency trên DB thật.

Trên quán test, sau khi xác nhận đúng tài khoản seller:
1. Mở quán ở Tổng quan, refresh: open; đóng: closed.
2. Đối chiếu màn Cửa hàng và checklist; lặp vài lần cả desktop/mobile.
3. Đọc restaurants theo đúng ID: chỉ operating_status/updated_at thay đổi;
   avatar/lịch/status/owner giữ nguyên, đơn pending/accepted không bị đổi.
4. Hai phiên cùng gửi đích giống/khác nhau: đối chiếu GET sau thao tác;
   không dùng request lần lượt làm bằng chứng concurrency.
5. Student không thể checkout mới khi closed; seller vẫn quản lý được.
6. Chưa đăng nhập/seller khác/staff bị từ chối API đóng/mở.

Chưa kiểm thử browser/Cloudinary/Supabase thật trong lượt này. Không coi mock
PASS hoặc build PASS là chứng minh ghi DB hoặc UI thật đã hoạt động.

## Điều tra phản ánh VALIDATION_ERROR

Chuỗi UI “Dữ liệu đổi trạng thái cửa hàng không hợp lệ.” là mapping trong
open-client của error.code=VALIDATION_ERROR. Route hiện tại chỉ trả mã này từ
SellerValidationError: UUID, object/allowlist payload hoặc operating_status,
trước khi gọi RPC. RPC error và response sai sau ghi dùng mã khác.
Thông báo UI một mình không xác định field nào sai, hoặc server đang chạy bản nào.
Cần Response error.code/error.message và Request Payload của request thật;
không lấy Headers/cookie/token. Không gửi lại mutation để đoán.

Đã tái hiện in-memory bằng service từ HEAD 569a1cf và route hiện tại:
body closed →400 VALIDATION_ERROR, message “operating_status: Chỉ chấp nhận open.”,
không gọi RPC. Working tree chấp nhận closed và test nối thật client → access
parser → route → service → SDK mock → readback đã PASS. Đây là bằng chứng bản
cũ có thể gây lỗi tương tự, chưa xác nhận server localhost đang dùng bản cũ.

Test trước chia riêng client/route, nên chưa chứng minh hai tầng làm việc cùng
nhau và chưa xác minh bản runtime. Test mới nối các tầng, kiểm tra closed qua
RPC mapping và GET không lọc quán đóng, kể cả commit xong nhưng phản hồi hỏng.
Chưa có session/quán test được xác minh trong lượt điều tra này; chưa gửi mutation
hoặc quan sát DB thật. Không viết lại logic đóng đang đúng trong working tree
để chiều theo phản ánh khi chưa có request thực tế.

### Kiểm tra bổ sung ngày 2026-11-14

Browser GET /seller trả ERR_CONNECTION_REFUSED; GET /api/seller/access từ
terminal ngoài sandbox cũng bị connection refused tại localhost:3000. Không
khẳng định bản runtime đang chạy code cũ, không tự khởi động/restart server.
Cần người dùng khởi chạy đúng folder (hoặc báo đúng port), rồi kiểm tra session
test và GET seller access trước khi gửi lại bất kỳ mutation nào.

Đã sửa riêng một lỗi application sau RPC: envelope SDK null/undefined từng gây
TypeError →500 RESTAURANT_OPEN_FAILED, làm client bỏ qua đọc lại dù commit có
thể đã thành công. Guard mới trả 503 RESTAURANT_OPEN_RESULT_UNKNOWN để helper
GET đối chiếu. Regression test FAIL trước sửa (500 thay vì 503), PASS sau sửa;
test nối client/route/service/readback xác nhận chỉ một mutation. Đây không phải
nguyên nhân đã xác minh của thông báo VALIDATION_ERROR người dùng phản ánh.

Để kiểm tra function/overload hiện triển khai, chạy riêng SELECT metadata:

```sql
SELECT n.nspname AS schema_name,
       pg_get_function_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS settings,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS can_execute,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'set_restaurant_operating_status' AND p.prokind = 'f';
```

Không có kết quả chỉ cho biết không thấy function đó trong schema public theo
phạm vi truy vấn; không kết luận mọi schema đều không có RPC. Chưa chuẩn bị SQL
thay đổi khi chưa biết function hiện triển khai khác contract ở điểm nào.

Kiểm tra local bổ sung: 764/764 test PASS, scoped lint và TypeScript PASS.
`npm run build` trong sandbox không tiến khỏi bước tạo production, đã dừng
riêng tiến trình đó. Chạy lại cùng lệnh ngoài sandbox PASS (compile, TypeScript,
39/39 trang tĩnh), không khởi động/restart dev server. Không suy ra DB/UI thật
hoạt động từ kết quả này.
