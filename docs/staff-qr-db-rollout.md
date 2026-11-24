# QR staff: đề xuất DB và application để review

Trạng thái: SQL CHƯA ÁP DỤNG, SQL/local DB concurrency CHƯA CHẠY. Application
đã nối contract mới; không xem declaration trong types hoặc mock RPC là bằng
chứng DB đang hỗ trợ. Không cần DATABASE_URL, không sử dụng admin làm caller.

## File và đối tượng

1. supabase/migrations/202610310001_staff_qr_join.sql: một transaction, tạo đúng
   hai function public.join_staff_qr(text) và public.sf_guard_staff_identity(),
   hai trigger sf_guard_staff_user/users và sf_guard_staff_owner/restaurants.
   Không sửa bảng/cột/enum/index/RLS hoặc RPC nghiệp vụ cũ. Abort nếu trùng function.
2. supabase/rpc/staff_qr_inspection.sql: SELECT preflight/hậu kiểm, không dữ liệu
   người dùng hoặc giá trị khóa. File nhiều SELECT nên xem kết quả từng query.
3. supabase/rpc/staff_qr_local_test.sql: dành riêng DB Supabase LOCAL bỏ được,
   nhận UUID fixtures qua psql variables; test guard, token bị sửa, join/replay và
   rollback dữ liệu test. KHÔNG chạy trên production; không tạo auth.users trực tiếp.
4. supabase/rpc/staff_qr_rollback.sql: chỉ drop đúng object mới, không sửa dữ liệu
   user đã join hoặc các grant cũ. Review trước chạy; đừng drop object cùng tên
   nếu không do migration này tạo. Rollback làm mất bảo vệ direct write trước đây.

## Khóa ký và prerequisite an toàn

Giữ HMAC-SHA256 và payload v1 hiện có, prefix studentfood.staff-invite:v1:.
Cùng key UTF-8 chính xác (không trim) phải có ở server STAFF_INVITATION_SECRET và
một entry Vault tên staff_invitation_hmac_v1. Người vận hành cấu hình qua Supabase
Vault UI/quy trình secrets riêng, KHÔNG paste giá trị vào source SQL, chat, ticket,
console hoặc lịch sử SQL. Không tự đổi key đang dùng; không dùng service-role key
làm khóa HMAC. Nếu cần tạo lần đầu, dùng CSPRNG ít nhất32byte và giữ bản biểu diễn
text giống nhau ở hai nơi. Agent không đọc/configure môi trường thật.

Vault là prerequisite có sẵn, không được migration tự cài extension hoặc tạo bảng.
Cần vault.decrypted_secrets và extensions.hmac(bytea,bytea,text); nếu pgcrypto ở
schema khác thì quản lý DB đối chiếu và chỉnh qualification trước review. Không
fallback sang secret GUC, plaintext table, request claim hoặc cờ verified.
Migration từ chối client đọc decrypted view/ghi vault.secrets hoặc gọi mutator Vault
khi có schema USAGE. Quản lý DB phải kiểm tra thêm hàm SECURITY DEFINER hiện có có
thể đọc/sửa Vault hoặc thực thi SQL tùy ý; schema không expose không thay quyền.
Không tự revoke Vault toàn cục để migration qua: nếu prerequisite không đáp ứng,
cần quản lý DB xử lý và đánh giá ảnh hưởng riêng trước áp dụng.
Nguồn thiết kế Vault: https://supabase.com/docs/guides/database/vault

Không log p_token, payload, key hoặc SQL parameters: API chỉ trả lỗi allowlist.
Preflight xem cấu hình parameter/statement logging; người vận hành xác nhận API,
proxy, DB tracing không ghi request body/parameter chứa token. Đặc biệt không bật
log_parameter_max_length_on_error cho QR. Migration không sửa logging toàn hệ thống.

## RPC trực tiếp và transaction

Chỉ authenticated có EXECUTE RPC mới, không PUBLIC/anon/service_role. auth.uid()
xác định student, không nhận userId/role/restaurantId/issuer/verified flag riêng.
SECURITY DEFINER owner postgres, search_path trống, mọi bảng/crypto được qualify.
RPC tự decode canonical base64url, HMAC cùng prefix, so sánh đủ32byte không thoát
sớm theo prefix, validate đúng7claims/type/UUID/nonce/version/purpose/iat+300/exp.
Vì vậy gọi Data API RPC trực tiếp với token giả cũng phải thất bại; grant EXECUTE
không thay thế chữ ký. Key chỉ đọc bên trong function qua Vault private.

Sau xác thực token: khóa student+issuer ORDER BY UUID rồi restaurant FOR UPDATE;
đọc lại role/status/assignment và owner dưới khóa. Không lọc status/operating_status
của quán. Kiểm tra clock_timestamp() SAU chờ tất cả khóa, không dùng thời điểm đầu
transaction để quyết định expiry. Conditional UPDATE ba field và ROW_COUNT=1;
exception hủy toàn bộ RPC, không consume nonce. Hai quán tranh cùng user: một
commit, request sau khóa thấy staff/assignment và lỗi; timestamp không bị đổi lại.
Request lặp trả409, không idempotent success hoặc chuyển staff sang quán khác.
Cùng token vẫn dùng được cho nhiều student, token mới không gia hạn token cũ.

## Quyền trực tiếp và phạm vi ảnh hưởng

Trigger INVOKER kiểm tra current_user, không tin GUC/JWT client tự đặt. Chặn
anon/authenticated thay users.id/role/status/work_for_restaurant_id/updated_at;
chặn browser INSERT/DELETE users để không tái tạo profile inactive/privileged.
Profile name/phone/avatar update không đụng cột bảo vệ vẫn giữ quyền như trước;
caller hiện tại dùng update_my_profile RPC. Auth profile creation và Zalo/Google
upsert trong repo dùng trusted admin/Auth trigger, giữ nguyên hành vi.

Restaurant: chặn sửa id/owner_id trực tiếp; browser INSERT chỉ nhận owner=auth.uid()
là seller active, không tự giới hạn một quán/chủ. SDK PATCH seller hiện chỉ đổi
name/description/location/operating_hours/updated_at nên không vướng guard.
register_seller/add_staff_by_phone/remove_staff SECURITY DEFINER với owner trusted
vẫn ghi được như trước; migration không thay nội dung/grant các RPC đó. Preflight
abort khi các RPC tìm thấy chạy INVOKER hoặc owner anon/authenticated. Manager
cần xác nhận definition/owner, test hồi quy cập nhật profile, đăng ký seller,
phone recruitment/removal, sửa quán, Auth provisioning và contact-email trigger.

Không bật RLS hàng loạt hoặc revoke bảng. Đây KHÔNG phải sửa toàn bộ quyền dữ liệu:
quyền đọc PIN, sửa field khác ngoài quyền, DELETE restaurant và quyền orders/banks
hiện có chưa được giải quyết. Mọi function trusted có khả năng sửa identity vẫn
là trust boundary cần audit. Không thử exploit dữ liệu thực để xác nhận.

## Thứ tự review/áp dụng

1. Lưu definitions/ACL/trigger inventory hiện tại bằng inspection SELECT; xác nhận
   tên object mới chưa tồn tại, Auth/profile/RPC owners trusted và Vault private.
2. Cấu hình named key riêng qua Vault UI, khớp server; xác nhận key chưa lộ và
   logging không ghi token. Không xuất/so sánh key trong kết quả gửi chat.
3. Chạy migration trên DB local/staging phù hợp, thử SQL local và các ca concurrency
   bên dưới. Chỉ sau khi nhóm review chấp thuận mới áp dụng migration lên Supabase.
4. Chạy SELECT hậu kiểm: EXECUTE chỉ authenticated, owner/search_path/2trigger
   enabled đúng, RPC cũ/ACL không đổi; NOTIFY reload schema trong migration.
5. Deploy code join mới. Nếu RPC chưa có:503 STAFF_JOIN_RPC_UNAVAILABLE; thiếu key:
   503 STAFF_TOKEN_CONFIGURATION_MISSING; timeout/response sai:503
   STAFF_JOIN_RESULT_UNKNOWN, không retry; kiểm tra profile trước khi gửi lại.
6. Chạy API/UI với dữ liệu test riêng; lưu IDs/FK trước khi tạo, cleanup đúng ID.

Rollback: tạm ngưng join/mint ở tầng vận hành, roll application về phiên bản chặn
join trước ghi, review rồi áp dụng rollback SQL. Không tự trả staff về student.
Drop guard khôi phục lỗ hổng direct-write cũ; cần hạn chế truy cập trong lúc rollback.

## Checklist sau áp dụng (chưa thực hiện)

- Direct authenticated UPDATE role/assignment/status/updated_at hoặc owner/id thất bại;
  browser INSERT/DELETE profile thất bại; profile/quán hợp lệ và RPC cũ vẫn chạy.
- RPC direct không session/anon bị từ chối; fabricated token, sửa claims/signature,
  sai purpose/version/nonce/expiry bị từ chối, không cập nhật bất kỳ user nào.
- Seller active tạo QR cho quán inactive/closed; giải mã PNG đúng payload; hai
  student active/unassigned dùng cùng token đều join; read độc lập đủ3field.
- Staff/seller/inactive/already-assigned bị từ chối; retry timestamp/assignment giữ nguyên.
- Token mới không gia hạn cũ; chờ300giây thực kiểm tra cũ410; key mismatch fail safe.
- Hai session DB/API cùng student, token từ hai quán: chỉ một thắng; so sánh role,
  work_for_restaurant_id, updated_at sau commit. Không dùng hai request tuần tự.
- Local concurrency: session A BEGIN + join RPC (chưa COMMIT), session B gọi RPC
  cùng student/token quán khác (phải chờ), A COMMIT; B phải lỗi, dữ liệu A giữ nguyên.
- Local expiry-after-wait: A chỉ khóa student, B dùng token còn1giây (iat=now-299,
  exp=iat+300), A giữ khóa hơn1giây rồi COMMIT; B phải expired, không ghi. Không thay
  đồng hồ server. Dùng fixture/test key local; không in token hoặc SQL literal chứa token.
- API/UI session thật: cùngorigin, profile refresh, count-down, recreate/close,
  camera permissions/lifecycle, frame dedupe, lỗi/mạng/RPC chưa deploy không success giả.
- Thu hồi issuer role/status hoặc đổi owner trong các transaction cạnh tranh: join
  phải recheck sau khóa; ca đổi owner được admin test setup riêng, không dữ liệu người khác.
- Không thanh toán/thông báo ngoài hệ thống; không SQL INSERT auth.users.

## Giới hạn kiểm chứng hiện tại

Không tìm thấy psql/Docker trên PATH; chưa chạy SQL, privilege test hoặc concurrency
trên Postgres thật/local. Test application dùng implementation + mock SDK/RPC,
không phải bằng chứng migration hợp lệ hoặc lock/rollback thật. Chưa áp dụng bất
kỳ SQL thay đổi nào lên Supabase thật. Không đọc env thật hoặc restart dev server.

Kiểm tra local application cuối lượt: npm test 495/495 PASS (QR/UI48), lint phần
sửa PASS, TypeScript đầy đủ PASS, npm run build PASS (Next16.4.3,34trang). Đây
không phải kết quả thực thi SQL hoặc integration Supabase/OAuth/camera thật.

Vault prerequisite được giữ chặt: anon/authenticated không có USAGE schema Vault,
để tránh cả helper crypto/mutator ngoài hai tên đã biết. Nếu project hiện cấp
USAGE, migration dừng; không tự revoke schema/grant toàn cục. Quản lý DB cần đánh
giá caller Vault khác trước khi cung cấp cấu hình private phù hợp QR.
