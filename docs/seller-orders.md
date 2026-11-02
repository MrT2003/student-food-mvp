# Seller xem và xử lý đơn thật — 2026-11-02

## Trạng thái và phạm vi

Branch phong-order-integration, HEAD700f20d; merge backend MERGE_HEAD b84015d vẫn
chưa commit khi bắt đầu. Giữ nguyên32 file staged của lượt merge trước. Các file
của task này ở working tree/untracked, không tự stage/commit/đổi branch.
Không đọc env thật, sửa SQL/RPC/RLS/trigger/migration, ghi đơn thật hoặc restart server.

Trước đây SellerOrdersView gọi createSellerOrderFixtures khi mount, lấy quán demo,
changeStatus dùng transitionSellerOrder sửa state client (kể cả hoàn thành), bill
và count đều từ mẫu. Hiện lấy restaurantId từ SellerAccessProvider, dữ liệu qua
GET session API, không đọc preview/localStorage, không fallback mock.

## Đường gọi và file

- UI components/features/seller/SellerOrdersView.tsx: giữ card/tab/bill/bộ lọc,
  dùng UUID làm action và order_code hiển thị; key user+restaurant để bỏ state cũ.
- lib/seller/useSellerOrders.ts và orders-refresh.ts: tách initial/background read,
  polling10s khi visible/online, chặn hai nút trên đơn đang xử lý bằng Set,
  abort/bỏ qua response muộn khi unmount/đổi actor hoặc sau mutation;
  tải lại dataset sau mutation; không tự chuyển trạng thái trong state.
- lib/seller/orders-client.ts: GET list/detail, POST accept/reject body {}, cookie
  same-origin/no-store, timeout15s, kiểm tra actor/DTO, không retry POST; kết quả
  chưa rõ chỉ GET đúng order để đối chiếu.
- GET /api/seller/restaurants/[restaurantId]/orders và /orders/[orderId]:
  lib/seller/orders-http.ts -> services/seller-orders.service.ts.
- POST /api/orders/[orderId]/accept (giữ endpoint cũ), POST /api/orders/[orderId]/reject
  (mới): lib/orders/approval-http.ts -> OrderApprovalServices -> RPC session.
- types/seller-orders.types.ts và lib/seller/order-contract.ts: DTO/allowlist snapshot,
  lib/seller/orders.ts giữ mapping/filter/timezone, generic hỗ trợ DTO thật.
- tests/seller-orders.test.mjs mới; tests/staff-order-access.test.mjs cập nhật để
  kiểm RPC/readback thực tế thay cho điều phối UPDATE đã bỏ.

## Căn cứ DB và lựa chọn đường đọc

Người dùng đã gửi SELECT metadata Supabase ngày2026-11-02: order_items có
item_name_snapshot, unit_price_snapshot, selected_options, image_url, total_price;
KHÔNG có option_snapshot_price. get_restaurant_orders đang triển khai lại đọc
`oi.option_snapshot_price`. Đây là schema/function mismatch đã xác nhận từ metadata;
nhánh caller hợp lệ đi đến SELECT đó dự kiến lỗi42703. Agent chưa gọi RPC đó thật.
Authenticated có EXECUTE không làm cột còn thiếu trở nên hợp lệ.

Không sửa function, không gọi lỗi rồi fallback âm thầm. Chọn một đường đọc SDK
session có chủ đích, theo cột DB đã xác nhận; không dùng admin/service-role. DBA
cần sửa tham chiếu get_restaurant_orders sang selected_options và thống nhất DTO
(snapshot/total_price) nếu nhóm muốn dùng lại RPC cho các caller khác. Không có
SQL thay đổi nào được chuẩn bị/áp dụng trong task này.

Server xác minh getUser=actor, profile active/seller, restaurant id+owner. SELECT
orders còn lọc restaurant_id và embedded restaurant.owner_id=actor,
restaurant.owner.role=seller/status=active qua FK inner joins trong chính truy vấn.
Không fetch đơn mọi quán về browser để lọc. Read detail cùng guard + orderId.
Không ép quán active/open. Các tên FK dùng generated types/schema repo; chưa thử
embedded joins/permissions trên live DB. Nếu schema/quan hệ/quyền chặn, trả503
ORDERS_SCHEMA_MISMATCH hoặc403 ORDER_FORBIDDEN, không đường đọc quyền cao.

Server đọc phân trang ổn định created_at/id, tiếp tục tới trang rỗng kể cả cap
nhỏ hơn100, dedupe UUID rồi trả full scoped dataset. UI phân trang3 đơn trên dataset
đã tải; tab counts áp dụng cùng query/ngày trước pagination. Các page SDK không
phải snapshot transaction: dữ liệu mới/cập nhật đồng thời cần reload; không hứa
Realtime hoặc snapshot nhất quán toàn bộ lịch sử. Khối lượng lớn cần paging/count
DB chuyên biệt sau này, chưa tự tạo RPC/index.

RLS/grants đang rộng theo metadata cũ: các guard API không bảo vệ Data API trực
tiếp. RLS nếu lọc0 hàng có thể giống danh sách rỗng hợp lệ; cần đối chiếu bằng đơn
test đã biết. Không dùng admin để kiểm tra vượt quyền. Không tuyên bố hệ thống DB
đã an toàn chỉ vì application dùng session/owner filter.

## Snapshot, tiền và trạng thái

DTO chỉ trả id/restaurant_id/order_code/status/created_at, payment_method,
subtotal/total, delivery_address/customer_notes, customer name/phone và item
snapshots. Không trả student_id, checkout id, PIN/token/bank profile nội bộ.
Completed luôn ẩn phone như contract get_restaurant_orders. Không query menu lấy
lại tên/giá/ảnh. Thiếu giá/tên/phone/options có placeholder rõ, không dựng dữ liệu.

selected_options lấy từ snapshot, giữ tên group/option/giá thêm; không lấy catalog
options hiện tại. subtotal/total hiển thị đúng giá trị đã lưu, không cộng lại từ
items hoặc suy phí giao hàng bằng total-subtotal. Theo SQL checkout/fetch_ordered_items
trong repo, total_price là đơn giá/phần đã gồm options; UI ghi rõ /phần. Khi NULL,
chỉ ghi giá món snapshot và chưa có đơn giá đầy đủ, không giả bằng0 hoặc cộng options.
Không coi thông tin giá này là chứng minh checkout SQL hiện đang giống repo.

pending -> Chờ xác nhận; accepted -> Đã chấp nhận; completed -> Hoàn thành;
rejected/cancelled chung tab Đã hủy / từ chối, badge vẫn Bị từ chối/Đã hủy riêng.
Hôm nay dùng Asia/Ho_Chi_Minh, có test biên UTC17:00. Giữ search mã/tên, all days,
sort mới/cũ và bill đúng object trong dataset được cấp quyền, không đơn mock riêng.
Hoàn thành đơn đang disabled và nêu chưa nối, không thêm complete/cancel/refund/payment.

## Mutation và cạnh tranh

OrderApprovalServices trước đây UPDATE trực tiếp; hiện reuse accept_order/reject_order
bằng cùng session. RPC đã được người dùng gửi lại định nghĩa/quyền:
SELECT order FOR UPDATE -> kiểm quyền owner/active assigned staff -> kiểm pending ->
UPDATE accepted (+accepted_at=now()) hoặc rejected -> trả success/id/status.
Hai action khóa cùng hàng nên request thứ hai phải kiểm trạng thái sau khóa, không
chuyển lại từ accepted/rejected. Đây là phân tích định nghĩa, chưa concurrency live.

API active profile precheck; accept giữ quyền seller/staff đã giao trước, reject
mới chỉ nhận seller. Body phải object rỗng, UUID hợp lệ; Origin cùng ứng dụng;
không nhận role/restaurant/status/timestamp từ client. RPC trả success=false/sai
id/status là lỗi chưa rõ, không HTTP200 giả. accepted_at đọc lại từ DB để giữ
contract API accept cũ, không tự dựng timestamp ở application.

ORDER_INVALID_STATUS ->409 ORDER_CONFLICT, NOT_ALLOWED/42501 ->403, thiếu RPC
PGRST202/42883 ->503 ORDER_RPC_UNAVAILABLE, ORDER_NOT_FOUND ->404.
Network/response sai/readback thất bại ->503 ORDER_RESULT_UNKNOWN. Client chỉ GET
đúng đơn khi chưa rõ; nếu thấy trạng thái đích, báo đã đọc lại xác nhận; nếu trạng
thái khác, báo conflict/chưa rõ và reload. Không retry mutation/UPDATE/compensation.
UI chỉ chuyển tab/count theo dữ liệu tải lại, khóa cả accept/reject trong lúc xử lý.

Giới hạn DB phải giữ rõ: owner branch của hai RPC không kiểm active/seller bên trong
và function không khóa restaurant/user xuyên suốt kiểm quyền. API vẫn kiểm active/
role/owner; race đổi quyền sau precheck/giữa SQL kiểm quyền và UPDATE, hoặc gọi RPC
trực tiếp, không được giải quyết bằng thay đổi application này. DBA cần đánh giá
nếu yêu cầu bảo đảm thu hồi quyền đồng thời; không tự sửa function/policy trong task.

## Kiểm thử và manual checklist

### Cập nhật ngầm và polling

Nguyên nhân nhấp nháy: hook cũ setLoading(true) cho mọi GET; UI ẩn card/count
khi loading; catch xóa dataset. SellerAccessProvider cũng xóa quán khi lỗi mạng,
và effect phụ thuộc toàn object user nên profile refresh cùng identity vẫn khởi
động lại hiệu ứng. Hiện chỉ dùng loading lớn khi chưa nhận dataset thành công
(kể cả []); background giữ rows/count/bill/bộ lọc. Context phụ thuộc các primitive
identity, không dùng pathname làm identity quán, giữ quán cũ khi lỗi tạm thời.
Chuyển route vẫn refresh context; đổi tài khoản/role/quán vẫn bỏ dữ liệu cũ.
Auth/session thật sự bị xóa vẫn phải xóa dữ liệu, không giữ cache để che mất quyền.

Chưa có bằng chứng publication và RLS đủ an toàn cho Realtime; không đăng ký
channel hoặc đổi DB. Dùng GET API đã kiểm quyền hiện có mỗi10s sau khi request
trước hoàn tất, một timer và một GET list tại một thời điểm. Độ trễ thông thường
khoảng0–10s cộng thời gian API/DB, không phải cập nhật tức thời. API đọc full
dataset qua nhiều page nên dữ liệu lớn làm chậm chu kỳ; mỗi tab mở có chu kỳ riêng.
Request có timeout15s; lỗi liên tiếp backoff10/20/40/60s (tối đa60s), thành công
trở lại10s. Focus/reconnect cập nhật ngay; không tự retry mutation.

Chỉ polling khi component mount, document hiển thị và navigator online. Ẩn tab/
offline dừng timer, abort GET và bỏ kết quả muộn; resume/reconnect đọc ngay.
Focus lặp gộp vào request đang chạy. Cleanup gỡ listener/timer, abort và bỏ response.
401/403 hoặc mất quán đã xác nhận xóa dataset và dừng auto-refresh; chỉ thao tác
Thử tải lại rõ ràng mới thử xác minh lại quyền. Không lưu thông tin đơn vào storage.
Lỗi mạng/server giữ cả danh sách rỗng đã tải, hiển thị cảnh báo nhỏ ở vùng dành sẵn.

GET trước mutation bị invalidate/abort. Nếu transport vẫn trả về muộn, không dùng
kết quả đó và đợi nó kết thúc rồi thực hiện read mới; các yêu cầu đối chiếu gộp
thành một lần đọc sau khi các mutation đang chạy kết thúc. Success notice tách
khỏi refresh warning: đọc lại thất bại không báo mutation đã xác nhận là thất bại.
UUID giữ key; thay dataset không reset state bộ lọc/tab/sort/selectedId hoặc gọi
lại focus bill. Giữ Hôm nay làm mặc định, không thay logic lọc đơn cũ.

Test service/API/hook/component thật với mock Auth/Supabase/fetch/React hooks;
bao phủ quyền, đủ5status, SDK filters/full pages, snapshot/null/allowlist, RPC params,
responsefalse, lỗi/readback, lặp và cạnh tranh mô hình, no mock fallback, loading/
retry/count/bill/identity. Có test Supabase SDK thật với fetch mock xác nhận filter
nested/limit được serialize đúng; không chứng minh PostgREST/RLS/SQL live.

Kết quả local sau bổ sung polling: toàn suite692/692 PASS (62 test seller-orders,
28 test seller-access, hồi quy staff-order-access46/46); scoped ESLint0 lỗi/0 cảnh báo; TypeScript
noEmit/incremental=false PASS; build chuẩn PASS (compile/TypeScript/38 trang, có
API list/detail/reject mới); git diff --check PASS. Giữ nguyên các lỗi lint toàn
repo ngoài phạm vi đã ghi ở lượt merge trước, không sửa/tắt rule để đạt build.

API localhost thật không cookie: GET list401, accept401, reject401, reject sai
Origin403. Không RPC mutation/đọc dữ liệu đơn thật/ghi DB trong các ca này.
Chưa có UI browser thật hoặc accept/reject DB thật PASS. Không tạo/dọn tài khoản,
đơn hoặc dữ liệu test. Không gửi push/payment thật.

Checklist dùng student/seller TEST riêng, không thử trên đơn người khác:
1. Student tạo2đơn của đúng quán test qua checkout hiện có; ghi lại hai UUID và
   order_code, restaurantId, order_status, subtotal/total trước test. Không đưa cookie/
   PIN/credential vào chat/log. Nếu có external payment thật thì không thực hiện.
2. Seller đúng owner vào /seller/orders; chọn Tất cả ngày nếu cần. Hai đơn pending
   xuất hiện với mã đúng, snapshot món/options và giá đúng DB; tab counts theo bộ
   lọc hiện tại, không chỉ3dòng trên page. Mở bill kiểm đúng UUID/mã/snapshot.
3. Chấp nhận đơnA. Network POST /api/orders/UUID_A/accept ->200, list GET lại;
   pending giảm1, accepted tăng1; DB accepted_at được đặt.
4. Từ chối đơnB. POST /reject ->200; tab Đã hủy / từ chối tăng1, badge Bị từ chối;
   DB rejected (không phải cancelled). Không sửa thủ công DB để ca lỗi thành đạt.
5. Refresh/đăng nhập lại: A accepted, B rejected vẫn giữ; các field giá, quán,
   thanh toán, snapshot không thay đổi. Gọi lặp ->409 và không đổi trạng thái.
6. Dùng hai request đồng thời thật trên MỘT đơn test pending riêng để thử accept/
   reject: đúng một200, còn lại409; đối chiếu row cuối, không gọi tuần tự rồi báo
   concurrency. Ca này cần đơn test bổ sung được cho phép, không dùng đơnA/B đã xử lý.
7. Seller test khác không được GET/bill/accept/reject đơn quán này; đổi account,
   không thấy dữ liệu cũ. RPC/RLS/FK lỗi: ghi HTTP/code an toàn cho nhóm DB, không
   fallback quyền cao. Không thử ngoài quyền trên dữ liệu có sẵn của người khác.

Kiểm tra polling bằng hai phiên student/seller test riêng:
1. Seller giữ /seller/orders mở, mặc định Hôm nay; dùng student ở trình duyệt/profile
   khác đặt đơn test đúng quán qua flow hiện có, tránh thanh toán/thông báo ngoài hệ
   thống nếu flow có tác động đó. Không chỉnh DB thủ công để tạo bằng chứng checkout.
2. Không đổi tab seller: trong khoảng10s cộng độ trễ request, đơn/count cập nhật
   nếu thỏa query/ngày. Thử giữ tab Đã chấp nhận: tab không đổi, count pending đổi.
3. Mở bill, đặt bộ lọc/search/sort, đổi app rồi quay lại: rows/count giữ trong lúc
   Đang cập nhật; bill còn mở nếu đơn vẫn thuộc tập đang xem. Kiểm tra vị trí cuộn.
4. Offline/ẩn tab: không có polling mới; reconnect/quay lại đọc ngay. Lỗi API503
   giữ rows/count, cảnh báo;401/403 xóa và dừng tự tải. Dùng dữ liệu test riêng.
5. Network: một GET list đang chạy, không POST retry. Sau accept/reject, read
   authoritative chuyển tab/count; GET chậm trước write không khôi phục pending.
6. Logout/đổi account/quán/rời màn: không thấy đơn cũ, không polling của màn cũ.

Các test polling dùng fake clock và implementation hook/controller/component thật
với Auth/fetch/React boundary mock. Chưa kiểm thử DB/UI thật hoặc đo layout/scroll
trên trình duyệt trong lượt này; không tạo/chỉnh đơn thật, không restart server.
