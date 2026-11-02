# Mở nhận đơn từ Seller Dashboard

## Contract và đường gọi

`SellerOverviewView` (nút trạng thái và checklist cùng handler) ->
`openSellerRestaurant` -> `POST /api/seller/restaurants/[restaurantId]/open` ->
`SellerServices.openRestaurant` -> Supabase **session** RPC
`set_restaurant_operating_status(p_restaurant_id, p_operating_status='open')`.

Body chỉ `{ "operating_status": "open" }`. UUID bắt buộc; JSON object, field lạ,
thiếu field, null/array hoặc đích khác open bị từ chối. Chỉ POST, Origin cùng ứng
dụng, getUser xác minh session; service kiểm tra lại actor, profile active/seller,
quán theo id + owner_id. Không mở quyền cho staff trong API/UI này. Không admin,
pg/DATABASE_URL, UPDATE bù hoặc nới PATCH thông tin quán.

200 response allowlist:
`{ restaurant: { id, operating_status: "open" }, alreadyOpen: boolean }`.
Quán đã open trả alreadyOpen=true từ SELECT đã xác minh, không gọi lại RPC hoặc
đổi updated_at. Quán paused trả 409 OPERATING_STATUS_CONFLICT: chưa làm nghiệp vụ
paused/đóng quán. Không yêu cầu món/ảnh/ngân hàng; không tự chuyển status inactive
thành active. UI tách operating_status và ghi rõ khi quán còn inactive.

## Căn cứ RPC và giới hạn DB

Types repo khai báo đúng chữ ký. Thân hàm/quyền đã được người dùng cung cấp trong
kết quả xuất Supabase trước đây (attachment 6e1e717e-03c3-4a94-8e76-379dc8b27ab3).
Agent đọc lại định nghĩa đó, không chỉ suy từ tên/type và không thực thi SQL:

- SECURITY DEFINER owner postgres, search_path rỗng; EXECUTE anon/authenticated/
  service_role theo bản xuất. Quyền EXECUTE không tự cho phép mở quán vô danh.
- Chỉ UPDATE operating_status, updated_at theo id và owner=auth.uid(), hoặc staff
  active được phân công. Không sửa status/slug/lịch/bank. API này vẫn chỉ nhận seller.
- Không có điều kiện món/ảnh/bank, status active hoặc trạng thái nguồn trong RPC.
- Owner branch của RPC **không** kiểm tra active/seller. API kiểm tra ở application;
  không có transaction gộp precheck với RPC. RPC kiểm tra owner tại UPDATE nhưng
  race đổi role/status sau precheck và đường gọi RPC/Data API trực tiếp không được
  giải quyết trong task này. RLS/quyền rộng đã báo trước vẫn cần DBA đánh giá.
- API kiểm tra closed trước RPC, nhưng RPC không có điều kiện so sánh trạng thái
  nguồn. Một thay đổi paused/closed đồng thời ngoài luồng này không được bảo vệ
  bằng CAS. Không tuyên bố đã tuần tự hóa mọi đường đổi trạng thái.

Không có connector Supabase/Postgres đọc live được cấp sẵn trong lượt này; chưa
đọc lại định nghĩa đang triển khai hôm nay. Bản xuất trước là căn cứ do người dùng
cung cấp, không phải bằng chứng integration mới. Không sửa schema/RPC/policy/trigger.

## Lỗi và đồng bộ UI

- 401 session; 403 inactive/sai role/quyền RPC; 404 quán không tồn tại/không thuộc
  seller; 400 JSON/UUID/validation; 409 trạng thái nguồn ngoài phạm vi.
- PGRST202/42883 hoặc INVALID_OPERATING_STATUS ->503
  RESTAURANT_OPEN_RPC_UNAVAILABLE; không fallback UPDATE/admin.
- Network/timeout hoặc JSON RPC sai contract ->503 RESTAURANT_OPEN_RESULT_UNKNOWN;
  không retry mutation/compensation. Lỗi DB còn lại trả thông báo an toàn, không
  log/return raw message/details, token hoặc credential. Response no-store.

Client đọc GET /api/seller/access trước mỗi lần thử, tránh POST khi đã open.
POST có timeout 15 giây; sau response thành công hoặc kết quả chưa rõ, chỉ GET
đọc lại cùng user/quán. Chỉ xác nhận mở khi GET cho thấy operating_status=open.
Nếu HTTP lỗi nhưng GET xác nhận open, thông báo rõ đã đọc lại và xác nhận trạng thái,
không tự coi HTTP lỗi là thành công. Lỗi quyền/RPC thiếu đã biết không báo mở giả.
Không tự POST lại; đọc lại thất bại yêu cầu tải lại trước thử lại.

Sau xác minh, dispatch seller-access-changed để context tự GET lại. UI chỉ render
operating_status từ context; không tự gán open hoặc dùng preview/localStorage.
Loading chặn cả nút chính và checklist. Open thì nút không còn mời mở, chỉ checklist
mở nhận đơn được đánh dấu; không đánh dấu các mục thiết lập khác. Response theo key
user+quán, identity guard và unmount guard không ghi đè context của tài khoản mới.

## Kiểm thử và kiểm tra thật

`tests/seller-open.test.mjs` gọi service/route/client/component thật với mock SDK,
Auth, fetch/hook. Bao phủ quyền, Origin, body, params RPC/session, lỗi/malformed,
no-op khi open, pending/click trùng, readback, timeout mô phỏng và response cũ.
Fixture RPC chỉ mô hình hóa định nghĩa đã cung cấp, không chứng minh DB SQL/quyền/
race thật. Hồi quy toàn suite gồm đăng ký closed, seller-access, quán/lịch và bank.

Đã thử API localhost thật không cookie/session: POST sai Origin ->403 FORBIDDEN,
POST đúng Origin chưa đăng nhập ->401 UNAUTHORIZED, GET /open ->405.
Không ghi dữ liệu hoặc mở quán trong các ca này. Chưa thử RPC mutation bằng session
seller/quán test, chưa có kiểm thử UI browser thật; không coi mock PASS là DB PASS.
Không tạo tài khoản/dữ liệu test nên không có dữ liệu cần cleanup.

Kết quả bản cuối: npm test 605/605 PASS (gồm 52 test mới của luồng mở);
scoped ESLint 0 lỗi/0 cảnh báo; build chuẩn PASS, tạo 35 trang và có route /open.
Một lần tsc chạy đồng thời build gặp TS2307 thiếu ./routes.js từ .next/types/validator.ts.
Sau build đã xác minh routes.d.ts/validator.ts có mặt và chạy riêng
`npx tsc --noEmit --incremental false` PASS. Không sửa/xóa generated types/cache hoặc
tắt kiểm tra. `git diff --check` PASS. Không coi các kết quả này là RPC mutation PASS.

File tạo/sửa trong task này: services/seller.service.ts; types/seller.types.ts;
app/api/seller/restaurants/[restaurantId]/open/route.ts; lib/seller/open-client.ts;
components/features/seller/SellerOverviewView.tsx; styles/seller-overview.module.css;
tests/seller-open.test.mjs; tests/seller-sdk-fixture.mjs; tests/seller-access.test.mjs;
docs/seller-open.md. Giữ nguyên những thay đổi đã có trước, bao gồm QR/SQL đang chuẩn bị.

Chỉ kiểm tra ghi bằng tài khoản và quán TEST chuyên biệt được phép mở:

1. Lưu ID quán test và đọc các cột dưới đây trước khi thử. Không dùng quán đang
   vận hành nếu chưa được chỉ định. Không tạo đơn/thanh toán.
2. Mở /seller, xác nhận đúng user/quán và operating_status=closed. Nhấn Mở nhận đơn
   ở thẻ hoặc checklist một lần. Xem Network: POST /open, sau đó GET /seller/access;
   không chụp/copy cookie, request header hoặc thông tin nhạy cảm.
3. Mong đợi trạng thái Đang mở từ GET; refresh rồi đăng xuất/đăng nhập lại vẫn open.
   status (active/inactive), slug và operating_hours giữ nguyên. Không tự bật active.
4. Lặp API khi open trả200 alreadyOpen=true, không gọi lại RPC/đổi timestamp qua
   luồng tuần tự này. Sai quyền/Origin/body phải không ghi. Ca ngoài quyền chỉ
   dùng hai quán test đã chỉ định, không dùng dữ liệu người khác.
5. Nếu lỗi/timeout, đọc lại trạng thái trước thử lại. RPC thiếu/quyền chặn báo mã
   cụ thể cho DBA; không sửa trực tiếp dữ liệu để biến ca lỗi thành đạt.

SELECT chỉ đọc cho đúng quán test, thay placeholder UUID trực tiếp trong SQL Editor:

```sql
SELECT id, status, operating_status, slug, operating_hours, updated_at
FROM public.restaurants
WHERE id = 'TEST_RESTAURANT_UUID'::uuid;
```

Đây là thay đổi trạng thái có chủ đích trên quán test. Chưa thêm thao tác đóng quán
ở UI/API này. Nếu cần khôi phục sau test, dùng cơ chế quản lý có sẵn đã được duyệt;
không xóa quán hoặc sửa dữ liệu của người khác.
