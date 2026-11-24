# Kiểm thử server đang chạy — 2026-10-26

Nhánh phong-seller-integration. Giữ nguyên merge/index và mọi thay đổi có sẵn.
Không đọc/sửa bất kỳ file env, không chạy script kiểm tra env, không trích credential,
không dừng/restart server và không tạo server khác. Không sửa UI/schema/RPC/policy.

## Đường gọi đã truy vết

| Luồng | Đường thực tế | Phân loại |
| --- | --- | --- |
| Catalog công khai | Home/Explore/restaurant page → RestaurantService → session Supabase SELECT restaurants/menu_items/options | DB thật; không fallback mock trong implementation đang chạy |
| Đăng nhập | Google/Zalo → Auth callback → Supabase Auth; getCurrentProfile đọc public.users | Session thật; user tự đăng nhập tài khoản test, không lấy cookie |
| Đăng ký seller UI | SellerRegistrationView.handleSubmit → registerPreview/sessionStorage → router.push(/seller) | Preview; không gọi POST /api/seller/register, không chứng minh role/quán được ghi |
| Sửa quán UI | SellerShopView → useSellerShopStore.update; lịch/tên/trạng thái preview | Client state, chưa gọi PATCH restaurant |
| Ngân hàng UI | SellerPaymentView → useSellerPaymentStore.save | Client state; QR chuyển khoản là hình minh họa, không phải QR tuyển staff |
| Quản lý menu seller | useSellerMenuStore → createSellerMenuFixtures/demoSellerRestaurant | Fixture runtime UI; ngoài service task đang kiểm thử |
| Đơn seller UI | SellerOrdersView → createSellerOrderFixtures → transitionSellerOrder/setOrders | Chỉ đổi state; chưa gọi API accept |
| Giỏ hàng | AddToCartBtn → CartServices; syncFromDatabase/action database-cart → CartServices/RPC | Có đường DB thật. Tên useStudentMockStore không đồng nghĩa toàn bộ giỏ là mock |
| Nhánh fallback giỏ | syncFromDatabase nuốt lỗi; update/remove nếu thiếu serverCart gọi action local | Có nguy cơ giữ state demo/cũ. Nằm ở store/UI của Triều, chưa sửa |
| Checkout xác nhận UI | OrderConfirmView.handleConfirm → checkoutCart → simulateCheckout | Vẫn checkout mock; action checkoutDatabaseCart thật đã có nhưng màn hình chưa dùng |
| Đọc đơn UI | useOrders/useOrderDetail/useCheckout → orderRecords trong store; syncFromDatabase gộp orders DB | Hỗn hợp state và DB, không phải truy vấn độc lập mỗi màn hình |
| Backend seller/staff | Các route /api/seller/*, /api/staff/join → auth.getUser → SellerServices → pg transaction; API accept → session Supabase UPDATE | Đường thật, không có fallback backend sang fixture |

Dữ liệu catalog lấy từ DB có tên giống mẫu vẫn là dữ liệu DB; không xóa hoặc đổi
chúng. Không thao tác các fixture ID của orderTestPanel vì chưa được tạo trong lượt này.

## Kết quả công cụ tự thực hiện

| Ca | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- |
| Bảy API ghi không session | 401, no-store | 7/7 đúng | PASS |
| Bảy API ghi Origin ngoài | 403, no-store | 7/7 đúng | PASS |
| GET join/QR | 405, không phát sinh nghiệp vụ ghi | 2/2 đúng | PASS |
| GET /api/test_restaurant/explore | Dữ liệu public từ service DB | 200, 10 quán | PASS |
| GET menu theo một slug public từ response trên | Có restaurant và items từ service DB | 200, 3 món | PASS |
| Đăng nhập trong tab test | User tự đăng nhập bằng test Google/Zalo | User xác nhận, tab chuyển từ login về Home | PASS ở mức UI/session; chưa xác minh UUID/role qua đọc DB độc lập |
| Validation có session | 400 trước pool/ghi | User chạy snippet trong tab đăng nhập và gửi ảnh: 12/12 HTTP400, PASS | PASS ở mức HTTP/validation; chưa đối chiếu DB độc lập |
| Đăng ký hợp lệ | 201, closed, seller, paymentSelectionPersisted=false | User gửi ảnh request thật: HTTP503 DATABASE_CONFIGURATION_MISSING, response không có restaurantId | BLOCKED cấu hình PostgreSQL của server |
| Đăng ký lặp, sửa quán, ngân hàng hợp lệ | Owner/role/data đúng; không ảnh hưởng quán khác | Chưa có quán test được tạo qua đăng ký | BLOCKED / chưa chạy nghiệp vụ ghi |
| QR/join/hết hạn thật/cạnh tranh | Nhiều student, hạn riêng, update nguyên tử | Chưa chạy với các session và dữ liệu test riêng | NOT TESTED |
| Staff checkout/accept | Quyền đúng, dữ liệu đơn đúng, cạnh tranh đúng | Chưa chạy nghiệp vụ có session | NOT TESTED |
| Đọc độc lập users/banks/orders, cleanup | So sánh trước/sau bằng session test hoặc công cụ DB được cấp | Không có connector DB; không lấy credential từ env | BLOCKED bởi khả năng công cụ, chưa kết luận lỗi DB |
| Camera/UI scan | Bộ quét trong ứng dụng hoạt động | Chưa có đường nối được kiểm thử | NOT TESTED / Triều |

HTTP smoke dùng scripts/check-seller-staff-http.mjs với đối số localhost:3000;
script không đọc env, không có cookie, chỉ in HTTP status và trạng thái cache.
Các ca 401 dừng trước validation, không được tính là validation nghiệp vụ đạt.

Không có connector Supabase/PostgreSQL được cấp sẵn. Browser chỉ hỗ trợ thao tác UI
và DOM read-only, không có API gửi POST JSON bằng session tab. Không lấy cookie để
chuyển sang Node. User đã đồng ý chạy snippet validation qua Console bình thường;
đây là kiểm thử có người hỗ trợ, không phải request agent tự thực hiện. Đã nhận
ảnh bảng 12 kết quả HTTP400/PASS: thiếu field/sai kiểu/chuỗi trắng/field lạ/owner/
role/thanh toán, PATCH rỗng, bank thiếu field, QR tự đặt TTL, join thiếu token và
accept ID sai. Không có thông tin credential trong ảnh. Mã lỗi bị cắt trên ảnh,
chỉ xác nhận được tiền tố VALIDATION_ và status; chưa có truy vấn DB trước/sau.

## SQL và giới hạn kết luận

SQL create_checkout_orders hiện tại trong repo nhận active student/staff và dùng
p_restaurant_preferences. Báo cáo cũ trước merge ghi student-only không còn áp dụng
cho source hiện tại. Chưa đọc định nghĩa triển khai trên DB, chưa quan sát lỗi
RLS/RPC; không suy ra một blocker DB chỉ từ các báo cáo cũ.

## Code, kiểm tra local và dữ liệu

Ảnh request đăng ký hợp lệ do user chạy xác nhận DATABASE_CONFIGURATION_MISSING.
Theo lib/database/server.ts, mã này được ném trước Pool.connect khi cấu hình kết
nối cần thiết không có giá trị hiệu lực; service chưa tới BEGIN/INSERT/UPDATE. Đây
là blocker môi trường đã quan sát, không phải bằng chứng RPC/RLS chặn. Đọc catalog
thật qua Supabase SDK không chứng minh kết nối pg đã được cấu hình. Không đọc env
để điều tra và không fallback sang hai request Supabase hoặc admin để né transaction.

Chưa phát hiện lỗi backend có đủ bằng chứng để sửa. Chỉ cập nhật tài liệu mapping
runtime/handoff, không nối UI ngoài phạm vi. Test fixture giữ nguyên.

Chưa chạy lại mock suite/TypeScript/build vì implementation chưa đổi; kết quả local
gần nhất trên nhánh tích hợp: 724 test liên quan đạt, scoped lint/TypeScript/build
đạt. Chúng không thay thế các ca integration còn thiếu. Không chạy build dùng chung
.next trong lúc user đang chạy dev chỉ để lặp lại kết quả cũ.

Chưa tạo tài khoản/quán/bank/cart/order trong lượt này, chưa xóa dữ liệu nào, chưa
có ID cần cleanup. Tài khoản test do user đăng nhập không được agent tự tạo hoặc
xóa. Không có bằng chứng ghi DB nghiệp vụ để kết luận backend thực tế hoàn tất.
