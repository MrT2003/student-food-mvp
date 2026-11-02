# Review thông tin quán/lịch và ngân hàng — 2026-11-01

Phạm vi: PATCH thông tin/lịch, đọc/thêm/sửa ngân hàng và caller hai màn đang có.
Không thay đổi đăng ký, QR/SQL QR, Zalo, orders/menu, env, branch hoặc database.
Các sửa đổi có sẵn trước review được giữ nguyên. Insert quán lúc đăng ký đã có;
không thêm chức năng tạo nhiều quán. Tài khoản/quán hiện tại của user không được dùng
để thử ghi khi chưa chỉ định là test.

## Đối chiếu implementation và caller

| Yêu cầu | File/hàm | Trước review | Sửa/bổ sung | Test implementation | Phụ thuộc/giới hạn |
| --- | --- | --- | --- | --- | --- |
| Active seller sở hữu quán | seller.service.ts: sellerSession/ownsRestaurant/updateRestaurant | Đã kiểm tra session/profile/owner, không lọc active/open quán | Giữ, không thay RPC toàn field | seller-restaurant-update.test.mjs; seller-banks.test.mjs | Precheck + SDK không atomic với đổi role/owner; cần quyền DB bảo vệ mutation |
| PATCH allowlist/omitted/null/max/zero rows | validateRestaurantUpdate/updateRestaurant và route PATCH | Đã có backend; UI max120/200 và chỉ lưu preview, bắt phone ngoài contract | UI max100/300/200; chỉ field dirty, bỏ phone khỏi payload/điều kiện lưu | seller-restaurant-update.test.mjs; seller-management.test.mjs | Cùng field cập nhật đồng thời là last writer wins; không hứa optimistic locking |
| Lịch same/daily/later | validatePatchSchedule/operatingHours; schedule-client.ts; ShopForm | Backend đã đúng; UI thiếu later và lấy lịch mẫu | Đọc JSONv1/timezone từ DB, map ngày/giờ, later NULL; lịch cũ cảnh báo, không gửi cùng sửa tên | Các test chuyển mode, ngày trùng/sai, khoảng giờ, body mode, field omitted | JSON cũ không tự migrate; cần DB thật kiểm chứng NULL và trigger |
| Refresh tên dùng chung | management-client.ts updateSellerRestaurant; SellerAccessProvider | UI đổi store preview | PATCH thành công invalidate nguồn seller-access chung | seller-management.test.mjs + seller-access.test.mjs | Chưa chạy UI browser thật trong lượt này |
| Ảnh/liên hệ/trạng thái | SellerShopView | Cloudinary upload chỉ preview; phone và trạng thái demo | Nêu rõ ảnh chưa persist; không bắt phone; trạng thái hiển thị từ DB, không bật nút giả | Test payload không chứa ảnh/phone/slug/status | Chưa persist avatar_url; không thêm hệ thống ảnh/trạng thái |
| Đọc bank của đúng quán | listRestaurantBanks + GET banks | Chưa có GET phục vụ UI | Auth/profile/owner, phân trang ổn định theo ID, response allowlist/no-store | seller-banks.test.mjs (bao gồm cap nhỏ hơn page size) | Nhiều page không phải snapshot transaction; reload khi danh sách có ghi đồng thời |
| POST/PATCH bank đúng quán | writeRestaurantBank + routes + BankManager | Backend có; UI store mẫu, giả lưu, ép 6–19 số | UI đọc API thật, thêm/sửa riêng field đổi, account_no string giữ 0, không tự đổi hoa | seller-banks.test.mjs; seller-management.test.mjs | Không xóa bank, xác minh chủ tài khoản hoặc thanh toán |
| Trùng/zero rows/lỗi an toàn | isBankConstraint/writeRestaurantBank | Đã map constraint chính xác, kiểm tra hàng trả về | Bổ sung regression exact schema/table, failed insert và read API | seller-banks.test.mjs | Constraint/index đã khớp metadata DB người dùng gửi; chưa test ghi thật |
| Tối đa một default/chuyển true | writeRestaurantBank | Chặn khi có default khác; chỉ mutation đơn khi chưa có | Giữ fail closed; UI không demote, không giả thành công; chuẩn bị SQL đề xuất riêng | Test POST/PATCH bị chặn trước ghi; simulated unique race | **Chuyển mặc định chưa hoàn tất**, chờ metadata/cơ chế DB nguyên tử |
| Không rò account cũ/click trùng | management-client.ts; ShopForm/BankManager | Preview store không theo user | Key user+quán, không persist bank, identity check trước/sau request, generation/unmount guard | seller-management.test.mjs | Test component bằng hook/HTTP mock, chưa phải browser/E2E |
| Cash/bank chưa lưu/áp dụng | SellerPaymentView | UI có badge/config/QR mẫu dễ gây hiểu nhầm | Hiển thị rõ chưa áp dụng; không suy từ có bank; không dùng QR minh họa để thanh toán | Test caller dùng đúng bank contract | Không triển khai payment methods, branch hoặc QR thanh toán |

## DB: đã có căn cứ và chưa xác minh

Schema repo `supabase/Query_PostgreSQL.txt` có bank_name/account_no/account_name varchar
không maximum, is_default boolean NOT NULL default false; FK restaurant_id cascade,
UNIQUE(restaurant_id,account_no) uq_restaurant_banks_account và partial unique
uq_restaurant_banks_one_default trên restaurant_id WHERE is_default=true.
Types database cùng tên bảng/cột. Riêng metadata DB đã được đối chiếu với kết quả
SELECT người dùng gửi ngày 2026-11-01, không chỉ suy từ schema repo:

- uq_restaurant_banks_account: UNIQUE(restaurant_id, account_no), valid=true.
- uq_restaurant_banks_one_default: UNIQUE(restaurant_id) WHERE is_default=true,
  valid/ready=true. DB có hàng rào tối đa một default, không tự chuyển default.
- PK id và FK restaurant_id -> restaurants(id) ON DELETE CASCADE đều valid.
- Không có trigger không-internal trên restaurant_banks trong kết quả truy vấn.
- Không tìm thấy function theo bộ lọc tên chứa bank hoặc thân tham chiếu
  restaurant_banks. Chưa loại trừ SQL động/hàm trung gian khác tên.
- anon và authenticated đều có quyền hiệu lực SELECT/INSERT/UPDATE trên mọi cột
  của bảng, gồm id, restaurant_id, is_default và timestamps. Kết quả này không
  phân biệt quyền toàn bảng với quyền cấp riêng từng cột.
- Nhóm SQL cuối gồm ba SELECT nhưng file chỉ có result set quyền cột. Chưa nhận
  result set mới của RLS/schema USAGE/quyền bảng và policy; không coi dữ liệu vắng
  trong file là false hoặc không có policy. RLS tắt vẫn là thông tin đã cung cấp
  trước đó, chưa được xác nhận lại bằng bộ kết quả mới này.

Xác nhận metadata không thay thế kiểm thử mutation, rollback hoặc cạnh tranh thật.

Metadata người dùng cung cấp trước đây: RLS users/restaurants/restaurant_banks tắt,
authenticated có quyền bảng rộng. Filter owner API không bảo vệ đường Data API trực
tiếp hoặc race đổi quyền. Không tự bật RLS/revoke/trigger; cần DBA đánh giá bảo vệ
đọc/ghi bank của đúng owner và active/seller tại mutation, tương thích caller hiện có.
Do chưa tìm thấy cơ chế atomic phù hợp, chuyển default giữa hai tài khoản tiếp tục
bị chặn trước ghi; không bỏ guard chỉ vì partial unique index đã được xác nhận.
Đã nhận constraint/index, trigger, function và quyền cột; còn thiếu result set mới
RLS/schema USAGE/quyền bảng và policy. Không có connector DB/psql/Docker
được cấp sẵn để tự xác minh SQL/transaction trong lượt này.

## Đề xuất tối thiểu cho default — CHƯA ÁP DỤNG

File `seller-bank-default-proposal.sql` chỉ để DBA review, không tự chạy và không
trộn migration QR. Đề xuất hàm MỚI seller_write_restaurant_bank(uuid,uuid,jsonb):
POST bankId NULL; PATCH bankId cụ thể; validation field đầy đủ ở DB, auth.uid từ
session, active/seller, owner và bank thuộc quán. SECURITY DEFINER owner postgres,
search_path rỗng, chỉ authenticated có EXECUTE, không dựa vào cờ client/admin.

Khóa user -> restaurant -> bank; không kiểm tra quán open/active. Khóa quán tuần tự
hóa caller RPC cùng quán kể cả chưa có bank. Demote đúng quán + insert/update đích
trong một RPC; lỗi unique/trigger/ghi đích làm hủy cả demote. Omitted giữ field,
POST mặc định false; PATCH false không chọn thay thế; UPDATE kiểm tra row_count.
Partial unique index valid đã khớp metadata người dùng gửi. Index chỉ bảo vệ số
default tối đa, không bảo vệ ownership hoặc gộp nhiều request SDK thành transaction.

**Chỉ thêm RPC không giải quyết quyền Data API trực tiếp đang rộng.** DBA cần review
quyền/RLS và caller đầy đủ trước triển khai bảo vệ DB; proposal không revoke toàn
bảng hoặc bật RLS mù. Application chưa gọi RPC đề xuất và không mock nó như đã tồn tại.
Sau khi thống nhất, áp dụng DB riêng, đọc lại định nghĩa/GRANT/index, kiểm thử bằng
session user, rồi mới nối đường chuyển default application. Không tự dùng SQL này
khi chưa nhận/đánh giá metadata. Rollback drop đúng hàm mới ở cuối proposal; không
hoàn tác dữ liệu đã ghi và không DROP CASCADE.

Trigger QR đang chuẩn bị chỉ bảo vệ users identity/role/assignment và restaurants
id/owner. PATCH quán này không gửi các field bảo vệ; bank không đổi role/owner.
Không sửa/áp dụng QR. SQL bank proposal chưa được chạy hoặc kiểm chứng bằng DB engine.

## Kiểm thử và xác minh tiếp

Local: test thật của service/API/component với Supabase/Auth/fetch/hook mock;
không kiểm chứng khóa, constraint, rollback hoặc RLS trên PostgreSQL. Kết quả chi
tiết: `npm test` cuối 553/553 PASS; scoped ESLint 0 lỗi/0 cảnh báo;
`npx tsc --noEmit --incremental false` PASS; `npm run build` cuối PASS
(compile + TypeScript + tạo 35 trang); `git diff --check` PASS.
TypeScript và build không thay thế integration. Không chạy SQL proposal.
GET localhost từ công cụ không kết nối được, không có session test chuyên biệt
sẵn dùng; không khởi động/restart server. Chưa có API/DB thật PASS hoặc UI thật PASS.
Không tạo tài khoản/dữ liệu DB/ảnh Cloudinary trong review; không có dữ liệu cần dọn.

File thay đổi trong review này (ngoài những sửa đổi đã có trước):
services/seller.service.ts; types/seller.types.ts;
app/api/seller/restaurants/[restaurantId]/banks/route.ts và _handler.ts;
components/features/seller/SellerShopView.tsx và SellerPaymentView.tsx;
styles/seller-payments.module.css;
lib/seller/management-client.ts và schedule-client.ts;
tests/seller-sdk-fixture.mjs, seller-banks.test.mjs,
seller-restaurant-update.test.mjs, seller-management.test.mjs;
docs/seller-banks.md, seller-restaurant-update.md, seller-bank-review.md,
seller-bank-default-proposal.sql. Không sửa các store demo dùng ở chức năng khác.

Các bước dùng tài khoản/quán TEST riêng (không quán đang vận hành):
1. Mở /seller/shop; xem đúng tên/quán. Lưu riêng tên, reload: tên giữ, slug và status
   không đổi; menu/sidebar đổi sau refresh nguồn seller-access.
2. Lần lượt lưu same (chọn ngày), daily (giờ riêng), later; reload và kiểm DB chỉ
   các cột name/description/location/operating_hours/slug/status/operating_status;
   later là NULL. Sửa tên không gửi lịch. JSON cũ chỉ thay khi bấm Lưu lịch.
3. /seller/payments: thêm bank giả không default, account_no string có 0 đầu; ghi
   chính xác ID trả về để cleanup. Reload, sửa riêng account_name, kiểm field khác
   giữ nguyên. Đối chiếu DB chỉ ID test; không chụp/log thông tin tài khoản.
4. Duplicate cùng quán ->409; cùng số ở quán khác không bị contract cấm. Seller B
   thử GET/PATCH bank/quán test A ->404, dữ liệu A không đổi.
5. Khi chưa có default, đặt một bank true phụ thuộc unique index live. Bỏ flag khi
   PATCH phải giữ; false cho phép không default. Có default A, thử tạo/chuyển B
   true ->503 hiện tại, kiểm A còn true và B không bị ghi dở. Không tự bỏ A để
   làm ca chuyển nguyên tử có vẻ đạt. Chờ cơ chế DB cho ca này.
6. Đổi user/logout, không thấy bank user cũ; gửi trùng khi đang lưu chỉ một request.
   Nếu lỗi mạng, đọc lại DB/danh sách trước gửi lại, không retry mù.
7. Cleanup bằng danh sách ID mới tạo và FK, do người có quyền thực hiện; không xóa
   hàng loạt, không xóa dữ liệu có sẵn. Chưa có endpoint xóa bank trong phạm vi.
