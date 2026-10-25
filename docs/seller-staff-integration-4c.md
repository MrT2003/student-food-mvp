# Kết quả kiểm tra đợt 4C — 2026-10-25

Đã review implementation và sửa lỗi application; chưa hoàn tất xác minh nghiệp vụ
trên Supabase thật. Không sửa schema, migration, policy, function/RPC, trigger, UI
hoặc chuyển sang đường quyền cao để né RLS. Branch vẫn là `phong`.

## Lỗi đã sửa

- Origin: so sánh trực tiếp với request.url khiến request hợp lệ dùng Host
  127.0.0.1 bị 403 khi Next chuẩn hóa URL sang localhost. Thêm
  `lib/http/request-origin.ts`, dùng trong các route seller/staff/order-accept thuộc
  phạm vi. So khớp Origin chuẩn với Host/scheme; từ chối Origin thiếu/null/sai và
  không tin X-Forwarded-Host. Không thay Auth/Zalo. Proxy phải giữ đúng Host/scheme.
- Khóa QR: kiểm tra độ dài trước đây vẫn nhận placeholder dài hoặc chuỗi lặp.
  `lib/seller/staff-token.ts` từ chối các trường hợp nhận diện được này. Đây là
  bộ lọc cấu hình, không phải phép đo entropy; khóa phải được sinh ngẫu nhiên.

Đã đọc luồng token/QR/join, purchase-access, cart/order và order-approval.
Không phát hiện thêm lỗi application có đủ căn cứ để sửa trong phạm vi này.
Mock chưa chứng minh khóa hàng, rollback, cạnh tranh hoặc quyền DB triển khai thật.

## Cấu hình và kết nối

- Đã sinh khóa QR local bằng node:crypto randomBytes(32), lưu trong .env.local đã
  được Git ignore; không in khóa, không thay khóa cũ, không sửa hosting.
- DATABASE_URL chưa được cấu hình local. SUPABASE_SERVICE_ROLE_KEY cũng chưa có
  nhưng không bắt buộc nếu tạo/dọn tài khoản qua Dashboard. Admin Auth chỉ dùng
  setup/cleanup, không dùng cho nghiệp vụ session để né RLS.
- Supabase Auth settings GET trả 200, disable_signup=false. Kết quả này không
  chứng minh anon key dùng được với REST hoặc đủ quyền quản trị Auth.
- REST OpenAPI GET trả 401, thông báo đã lọc: API_KEY_INVALID. Không suy luận
  schema/RPC/policy thực tế từ SQL repository hoặc từ Auth settings.
- Không có kết nối quản trị Supabase được cấp sẵn để đọc định nghĩa DB.

Cần người quản lý cấu hình riêng đúng URL/key của cùng project và DATABASE_URL phù
hợp TLS hiện có. Có thể setup/cleanup Auth thủ công theo hướng dẫn bên dưới, không
bắt buộc cấp service-role key. Không gửi credential trong chat. Không yêu cầu chạy
lại SQL thủ công để tiếp tục. Không tạo tài khoản khi chưa có đường kiểm tra/dọn an toàn.

## Kết quả thực tế

| Chức năng | Cách kiểm tra | Kết quả thật | Chưa xác minh |
| --- | --- | --- | --- |
| Kết nối metadata | GET Auth settings, REST OpenAPI tới Supabase đã cấu hình | 200 và 401/API_KEY_INVALID | Cột, FK, enum, grants, RLS, định nghĩa RPC |
| API seller/staff/accept | Next dev local, 7 POST/PATCH không cookie với Origin đúng/sai; 2 GET | 16/16 đạt: 401, 403, 405 tương ứng | Session đăng nhập và nghiệp vụ trên Supabase |
| QR PNG/token | Implementation qrcode/HMAC thật, giải mã PNG bằng jsQR; DB/Auth mock | Decode trùng qrPayload, kiểm thử token đạt | Seller thật tạo QR qua API đăng nhập |
| Join, nhiều student, hạn riêng, quán closed/inactive, gọi lặp và tranh student | Test implementation với connection mock | Bộ kiểm thử liên quan đạt | Ba field users sau commit, khóa/cạnh tranh/rollback DB thật |
| Quyền mua hàng và accept đúng/sai quán | Service implementation với Supabase mock | Kiểm tra application đạt | RPC checkout/cart, RLS/grants SELECT/UPDATE và cạnh tranh thật |
| Đăng ký seller, cập nhật quán, ngân hàng | Hồi quy service/API mock | Bộ kiểm thử liên quan đạt | Hồi quy DB thật chưa chạy |
| Camera/quét trong ứng dụng | Chưa thực hiện | Không có kết luận UI | Triều tích hợp và kiểm thử |

Không có integration test nghiệp vụ Supabase đã đạt. Các probe remote ở trên chỉ
đọc metadata; kiểm thử HTTP local không cookie không phải integration test DB.

## RPC/RLS cần người quản lý xác minh

- `services/order.service.ts` gọi `create_checkout_orders`. Bản SQL trong repo
  `supabase/rpc/create_checkout_orders.sql` chỉ nhận student; nếu triển khai đúng
  bản đó, staff checkout sẽ bị ACCOUNT_NOT_ALLOWED. Chưa đọc được định nghĩa
  Supabase thật nên chưa kết luận đây là blocker đã xác nhận trên DB. Người quản
  lý cần kiểm tra và cho staff hợp lệ mua hàng của chính mình theo cùng contract.
  Không đổi caller sang RPC khác hoặc dùng admin/pg để vượt hạn chế.
- RPC giỏ hàng và grants/RLS carts/orders cho staff chưa xác minh. Cần bảo đảm
  quyền mua hàng căn cứ auth.uid và role/active hiện tại.
- OrderApprovalServices dùng session client và UPDATE có điều kiện pending.
  Policy tại thời điểm UPDATE phải bảo vệ active/role/quán hiện tại, kể cả khi
  quyền đổi sau application precheck; cần kiểm tra seller sở hữu và staff thuộc
  đúng quán, cùng quyền SELECT/UPDATE order_status/accepted_at.
- Chưa xác minh client có bị cấm tự đổi role/work_for_restaurant_id hoặc sửa đơn
  ngoài quyền. Chưa thử khai thác, chưa sửa bất kỳ đối tượng DB nào.
- users.id = Auth UUID, staff enum, kiểu FK, default và constraint vẫn là giả định
  theo code/schema repo, chưa được xác minh trên DB thật.

## Kiểm tra chất lượng

- 716/716 test liên quan đạt (validation, đăng ký, quán, ngân hàng, QR, quyền staff,
  Origin). Test thực sự gọi implementation; Auth/DB được mock.
- Scoped ESLint đạt cho code/test/script liên quan.
- TypeScript toàn dự án: `tsc --noEmit --incremental false --pretty false` đạt.
- Lint toàn repo: 17 errors, 11 warnings ở các phần có sẵn; gồm test_restaurant,
  AddToCartBtn, useFlyToCart, scripts/test-auth-regressions.cjs và lỗi parser
  types/database.types.ts. Không sửa ngoài phạm vi.
- Lượt trước, `npm run build` thất bại thực tế: app/api/test_restaurant/restaurant/route.ts:2
  import useParams từ next/navigation vào server route. Không quy lỗi cho cache
  .next. Lượt tiếp tục được cho phép sửa route: build hiện đã đạt, xem bên dưới.
- `git diff --check` đạt. Không sửa TLS helper hoặc file trong supabase/UI.

## Dữ liệu thử và bàn giao UI

Không tạo tài khoản, quán, đơn hoặc ngân hàng trên Supabase; không có ID cần dọn
hay dữ liệu test giữ lại. Chỉ giữ khóa QR local trong file ignored. Server local
phục vụ kiểm tra HTTP đã dừng. Không phát sinh thanh toán/thông báo ngoài hệ thống.

Triều dùng contract trong [staff-recruitment.md](staff-recruitment.md): hiển thị
qrImageDataUrl, decode JSON type/version/token và gửi POST /api/staff/join với
session/Origin; countdown theo expiresAt, đóng modal chỉ ẩn QR. Mã dùng chung trong
300 giây, tạo mới không gia hạn mã cũ. Sau join tải profile và cập nhật auth store;
xử lý 409/410/503, không giữ role student cũ. Kết nối checkout/cart đang mock tới
service thực tế chỉ sau khi xác minh RPC/RLS. Chưa có bằng chứng kiểm thử camera.

Đã triển khai và kiểm thử bằng mock; chưa xác minh trên database thật.

## Lượt tiếp tục 4C: kiểm tra cấu hình và sửa build

Script đang dùng là `scripts/check-seller-staff-env.mjs`; không có bản `.cjs`.
Đã bổ sung chẩn đoán chỉ in cờ/trạng thái, không in URL/key/JWT claims/password:

- `node scripts/check-seller-staff-env.mjs` và thêm `--production` đều nạp
  .env.local rồi .env bằng @next/env, đúng thứ tự cấu hình của Next. Các helper
  Supabase dùng process.env do Next nạp; không tự nạp file khác.
- Supabase URL/key hiện lấy từ .env, không phải .env.local. URL có định dạng
  HTTPS project supabase.co; key là legacy anon JWT, claim ref khớp hostname,
  role anon và chưa hết hạn. Chưa xác minh chữ ký; claim khớp không chứng minh key
  được server chấp nhận. Key chưa nhận diện là placeholder.
- Với legacy JWT, probe gửi apikey và Authorization Bearer anon JWT. Với
  publishable key, chỉ gửi apikey. Không dùng service-role làm danh tính test.
- DATABASE_URL không có trong env hiệu lực hoặc .env.local, không phải trường hợp
  có giá trị placeholder. Secret QR được nạp đúng từ .env.local, giữ nguyên.
- Probe remote đã chạy lại: Auth settings 200, REST OpenAPI 401/API_KEY_INVALID.
  Đây là lỗi xác thực API key đã xác nhận, chưa phải bằng chứng lỗi RPC/RLS.

### Thao tác cấu hình trực tiếp trong .env.local

Trong Dashboard của đúng project, lấy Project URL và anon/publishable key hiện
hành từ phần API Keys; kiểm tra cặp đang cấu hình trước khi tự thay. Người dùng
điền trực tiếp local, không gửi giá trị qua chat. Không dùng secret/service-role
key trong NEXT_PUBLIC_SUPABASE_ANON_KEY.

```dotenv
NEXT_PUBLIC_SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<ANON_OR_PUBLISHABLE_KEY_OF_THIS_PROJECT>"
DATABASE_URL="postgresql://<USER>:<URL_ENCODED_PASSWORD>@<HOST>:<PORT>/<DATABASE>?sslmode=verify-full"
```

Lấy PostgreSQL connection string từ Connect của cùng project (direct hoặc pooler
phù hợp môi trường), dùng password DB thật đã URL-encode. Helper vẫn verify-full;
nếu provider yêu cầu CA, cấu hình CA tương ứng, không tắt xác minh TLS. Không thêm
prefix NEXT_PUBLIC_ cho DATABASE_URL; không thay secret QR. Khởi động lại Next sau
khi sửa env; chạy script preflight rồi --remote-metadata để kiểm tra lại. Build
thành công không chứng minh DATABASE_URL đã dùng được vì pool khởi tạo lười.

### Setup/cleanup Auth thủ công, không cần service-role key

1. Dashboard Authentication → Users → Add user/Create user: tạo bốn tài khoản test
   chuyên biệt của đợt này, email do người thử kiểm soát, mật khẩu riêng. Chọn tự
   xác nhận email nếu Dashboard hỗ trợ để không gửi thư mời/thông báo. Ghi UUID từng
   tài khoản và nhãn seller-A, student-A, student-B, outside/seller-B.
2. Không INSERT auth.users, không đặt role seller trong user metadata. Kiểm tra
   hồ sơ public.users tương ứng active/student/work_for_restaurant_id NULL; trigger
   tạo profile chỉ thấy trong repo, chưa xác minh trên DB thật. Nếu profile thiếu,
   dừng và ghi lỗi setup, không sửa trigger/policy để làm test đạt.
3. Seller-A/B ban đầu đăng ký qua API thật để đồng thời kiểm tra hồi quy, rồi dùng
   hai quán đó cho ca ngoài quyền/cạnh tranh. Chỉ tạo thêm tài khoản khi một ca
   cần trạng thái riêng. Dùng session đăng nhập từng test user với anon key; admin
   không làm danh tính gọi API. Khi cần runner, thông tin đăng nhập test lưu riêng
   local, không gửi mật khẩu/token qua chat hoặc commit.
4. Ghi chính xác ID tài khoản/quán/đơn/ngân hàng tạo trong đợt thử trước mỗi lần
   ghi. Sau thử dọn đúng các ID theo FK rồi xóa đúng Auth users trong Dashboard;
   nếu FK/quyền chặn, báo danh sách còn lại, không xóa hàng loạt/cascade tùy tiện.

Chưa tạo tài khoản/dữ liệu hoặc chạy integration test nghiệp vụ mới vì REST key
chưa được chấp nhận và thiếu kết nối PostgreSQL. Chưa xác nhận blocker DB nào;
những lo ngại RPC/RLS ở trên vẫn cần đọc định nghĩa và test user thật.

### Route build đã sửa và kiểm tra mới

Đã đọc toàn bộ route, RestaurantService và tìm nơi gọi: không thấy caller của
/api/test_restaurant/restaurant trong repo. Route này là đường tĩnh nên không có
dynamic params. Bỏ useParams client hook, nhận query slugParam, trả 400 khi thiếu,
await getRestaurantMenu trước khi trả {data}; giữ lỗi 500 khi không có menu và
không trả lỗi DB thô. Ví dụ: GET /api/test_restaurant/restaurant?slugParam=com-ngon.
Không sửa UI/caller hoặc bỏ kiểm tra của service.

- Bốn test mới gọi implementation route với service mock: 4/4 đạt.
- ESLint riêng route/script/test mới đạt; không chạy lại toàn bộ suite/lint cũ.
- npm run build đạt, bao gồm compile, TypeScript, tạo 29 trang và tối ưu build.
- Không thay key đã có, không đổi TLS, DB, branch hoặc commit/push.
