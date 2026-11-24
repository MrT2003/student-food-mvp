# Seller identity, navigation và route guard

## Nguyên nhân từ source

- HeaderDropdowns.AccountDropdown hardcode link /seller/register cho mọi account.
  StudentHeader dùng chung dropdown trên desktop/mobile, chưa có nhánh role/quán.
- SellerOverviewView đọc useSellerPreviewStore; SellerSidebar lại ưu tiên
  useSellerShopStore và nhãn Seller Demo, nên đăng ký RPC thành công không thay
  được identity hiển thị. Banner preview luôn bật lại sau mỗi mount.
- Seller page/registration page trước đây chỉ render component, không có guard
  server. Cache/preview không phải bằng chứng user đã có quyền seller.
- getCurrentProfile trước đây mặc định student/active khi thiếu DB profile; nay
  báo USER_NOT_FOUND, không lấy quyền từ metadata hoặc default.
- Register client trước đây chỉ refresh profile, không xác minh/invalidate quán;
  ROLE_CONFLICT luôn hiện lỗi ngay cả khi user đã sở hữu quán hợp lệ.

## Nguồn thật

SellerAccessServices.read dùng session client auth.getUser() và query allowlist
users(id,role,status,work_for_restaurant_id), sau đó restaurants theo owner_id
chính UUID đã xác minh. Không client ownerId, không users.*, PIN hoặc delivery_token.
GET /api/seller/access trả no-store, chỉ read, lỗi code an toàn.
Chỉ student active/chưa được gán quán và seller active được xét; các trạng thái
profile thiếu, role khác, quán thiếu, student đã sở hữu quán hoặc nhiều quán trả lỗi.
Limit2 để phát hiện bất thường, không chọn tùy ý quán đầu hoặc áp một-quán constraint.

## Guard, UI và cache

- Server layout app/(seller)/layout.tsx bảo vệ toàn bộ các route seller hiện có.
  Student về /account; chưa login về flow login; seller thiếu/quán bất thường/lỗi
  đọc nhận trang phục hồi, không tự đăng ký hoặc đổi role.
- /seller/register kiểm tra server: seller+quán về /seller; chỉ student đủ điều kiện
  thấy form. Client SellerRegistrationGate cũng chặn trang cũ trong router cache.
- SellerAccessProvider dưới AuthProvider là nguồn dùng chung cho dropdown, sidebar,
  overview. Key gồm user/quyền/path; không persist storage. Mask dữ liệu ngay khi
  key/account đổi, revision guard loại response cũ. Logout/reload không giữ shop cũ.
- Reload từ DB khi đổi route, focus hoặc seller-access-changed. Background refresh
  cùng user/key giữ dữ liệu đã xác minh để không unmount mất draft form khi chọn
  file/đổi tab. Đổi tài khoản vẫn xóa khỏi hiển thị ngay. Lỗi thật không biến thành
  student hoặc shop demo; có retry. Role cập nhật chỉ từ access API có session.
- Submit register giữ validation/PIN/Cloudinary/contract closed/payment=false cũ;
  sau201 đọc profile và owned shop, kiểm tra cùng actor/restaurant trước đồng bộ
  auth store và invalidation. Chỉ409 ROLE_CONFLICT có recovery: đọc lại cả profile
  và quán, xác nhận seller+ownership rồi mới điều hướng. Không coi403/mạng/lỗi khác
  là thành công và không retry POST tự động.
- Sidebar trên mọi seller page bỏ preview identity; overview chào đúng tên/quán/
  ảnh/status DB. Không còn banner đăng ký preview lặp mỗi refresh. Avatar thiếu dùng
  placeholder chung, không tự lấy ảnh Cloudinary chưa lưu ở DB.
- Menu dùng cùng logic desktop/mobile, ellipsis/title cho tên dài. Staff/inactive
  không có link đăng ký. Seller thiếu quán/lỗi đọc có trạng thái retry/phục hồi.

## Phạm vi còn chưa nối

Không triển khai orders/menu/payments/QR hoặc chức năng sửa quán mới trong lượt này.
Các màn riêng orders/menu/shop/payment vẫn có preview/mock như trước, nhưng sidebar
identity đọc DB. Form shop hiện có vẫn chủ yếu sửa preview: không tuyên bố nhấn lưu
đã sửa DB. Khi PATCH restaurant thật qua API, quay về overview/focus/refresh sẽ đọc
lại tên; caller client mới có thể dùng invalidateSellerAccess để đồng bộ ngay.
Overview không triển khai truy vấn số liệu/đơn/menu/payment; các giá trị giả0 và
cash đã chọn bị thay bằng trạng thái chưa có dữ liệu, không nhận là kết quả DB.
Checklist không tuyên bố0/4 hoặc hoàn tất dựa vào draft. Giữ5mục navigation.
Không sửa DB/schema/RPC/migration, không đọc env thật, không đăng ký lại quán có sẵn.
Auth provider vẫn yêu cầu hoàn tất phone như cũ, nhưng chuyển sang /account hiện có
thay vì /auth/onboarding đã bị pre-develop xóa; /account được bypass để không loop.
Callback Zalo giữ nguyên; login return URL đặt nội bộ
an toàn, không thêm redirect bên ngoài hoặc mở rộng luồng OAuth.

## Kiểm tra và giới hạn

Test gọi implementation với mock session/SDK/React: auth/owner/allowlist, các role,
missing/multiple shop, guard server/client, menu, dashboard/sidebar, recovery409,
late response, logout/account switch, error/retry/focus refresh. Không giả session
hoặc ghi DB thật. Test không chứng minh browser storage/session/OAuth thật hoạt động.
Browser Computer Use bị dừng do không xác định đủ chắc URL để thực thi policy;
không tiếp tục input và chưa xác minh bằng phiên seller thật.

Tự kiểm tra với seller đã tồn tại:
1. Tải lại trang, mở menu avatar: thấy tên quán, click vào /seller.
2. Kiểm tra sidebar/ảnh/lời chào khớp DB; mở trực tiếp /seller/register phải về /seller.
3. Refresh rồi logout/login lại; không cần đăng ký lại hoặc sửa quán.
4. Thử mobile và tên dài. Đổi sang account test student/staff khác, xác nhận không
   còn tên shop cũ; chỉ student đủ điều kiện có đường đăng ký.
5. Không chạy lại POST register hoặc ghi dữ liệu để kiểm tra menu của seller thật.

Kết quả local: npm test522/522 PASS; test access/registration-client33 PASS;
TypeScript đầy đủ PASS. Scoped lint exit0, còn1warning có sẵn ở điều hướng Zalo
window.location.assign trong auth.service.ts (không thay đổi dòng nghiệp vụ này).
Build chuẩn Next16.4.3 PASS,35trang. Request đọc localhost từ tool chưa kết nối
được, nên không có bằng chứng HTTP/session seller thật trong lượt này.
Không tự restart server hoặc dùng tài khoản khác để giả xác minh account của user.
