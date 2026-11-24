# Tích hợp origin/backend vào phong-order-integration — 2026-11-02

## Mốc Git và phạm vi

- Ours/HEAD: 700f20d9a202cbe02474ea436e635148e78f5532, từ phong.
- Incoming/MERGE_HEAD: b84015d940cf0ed496f6d8fd4a9cae898e160efa (origin/backend,
  PR31 Firebase Cloud Messaging); common ancestor f8b08d1c340f5cce396b40bef76ca52cef5c3b51.
- Tiếp tục merge đang dở, không chạy merge lại/fetch/đổi branch/reset/commit/push.
- Ban đầu chỉ có thay đổi staged/unmerged của merge, không có unstaged/untracked
  ngoài merge. Giữ toàn bộ seller/UI/QR/SQL đang có trên HEAD.

## Giải quyết conflict

| File | Kết hợp |
| --- | --- |
| .env.example | Hợp tên biến Supabase/Auth/Zalo/Cloudinary và Firebase Web/Admin; thêm tên STAFF_INVITATION_SECRET code QR hiện có dùng. Toàn bộ giá trị là placeholder an toàn, không lấy giá trị env thật. Không tái thêm callback client đã bỏ hoặc yêu cầu DATABASE_URL cho seller SDK. |
| AccountView.tsx | Giữ cả AccountStoreJoin và AccountNotifications, cùng AccountSecurity/form profile đang có. |
| AppProviders.tsx | AuthProvider -> SellerAccessProvider -> route children; giữ một ForegroundNotifications ngoài AuthProvider để lifecycle logout/account không giữ feed cũ. |
| package.json | Giữ scripts/toolchain hợp lệ của ours (Next16.4.3, ESLint9, TS5), pg/qrcode/types/jsQR; thêm firebase-admin ^14.5.0 và range lucide ^1.63.0 từ thay đổi backend. Không đưa duplicate dependencies/devDependencies hay update-types sai vị trí từ manifest incoming vào kết quả. |
| package-lock.json | Incoming và common-ancestor lockfile không parse JSON. Hợp package records dùng được từ hai phía làm đầu vào, sau đó npm install --package-lock-only --ignore-scripts --no-audit --no-fund và npm install --ignore-scripts --no-audit --no-fund. Root lock khớp manifest; chỉ package cũ lucide đổi resolved1.61.0 ->1.66.0 theo range backend, không nâng package/toolchain cũ khác. |

Không dùng toàn bộ ours/theirs để che conflict. Các SQL trên HEAD được giữ nguyên;
không có SQL/migration mới trong delta backend lần này, không áp dụng gì lên DB.

## Lỗi tích hợp và lỗi incoming được sửa

- useAuthFlow thiếu import useEffect và gọi setPending không tồn tại trong nhánh
  incoming. Dùng lại pendingProvider đúng contract Google/Zalo, giữ logout guard.
- RegisterView incoming truyền mode/pending trong khi SocialAuthButtons hiện có
  nhận pendingProvider. Kết hợp bằng pendingProvider + disabled dành riêng cho
  pending/failed logout, giữ spinner đúng provider và chống đăng nhập giữa logout.
- withPushLock có kiểu Promise<Promise<T>> với declaration DOM đang cài; await ở
  wrapper async giữ cùng semantics giữ lock tới khi action xong, không cast/nới type.
- API notification/token dùng Origin == request.url.origin không phù hợp cơ chế
  Next chuẩn hóa Host mà repo đã xử lý. Reuse isSameOrigin cho cả hai route;
  giữ Auth, expected user, validation, admin boundary sau Auth và owner filter.
- Foreground hook cũ khởi tạo Firebase khi user chưa bật push: có thể báo cấu hình
  thiếu trên seller dashboard dù push chưa sử dụng. Chỉ attach khi có opt-in đúng
  user; đồng bộ enable/disable từ event/storage, cleanup listener và kết quả muộn.
  Không thay cơ chế xin quyền hoặc tự đăng ký token.
- Sửa thông báo tên biến VAPID_PUBLIC_KEY lệch code/sample thành VAPID_KEY.
- docs/firebase-admin.md trỏ file mẫu đang bị ignore/không tồn tại; đổi về .env.example.

AuthProvider/auth.service tự merge được review: giữ profile role/status từ DB,
không khôi phục profile cũ khi logout/đổi owner; giữ phone guard /account của ours
và lifecycle unregister push trước signout của incoming. Thêm test regression.

## Kiểm tra local

- npm test: 628/628 PASS, gồm toàn bộ seller/staff/Zalo và 23 test tích hợp mới.
- TypeScript noEmit/incremental=false: PASS; chạy trước build, không song song ghi type.
- npm run build: PASS (compile, TypeScript, 38 trang), có ba API Firebase/notification
  và các API seller, QR/join, order acceptance như trước.
- Scoped ESLint phần tích hợp: 0 error, 1 warning cũ tại Zalo window.location.assign.
- Lint toàn repo: 9 errors,14 warnings. Bốn file có errors đều không thay đổi so
  HEAD: app/api/test_restaurant/explore/route.ts (1),
  components/features/home/ReorderSection.tsx (1), lib/cart/useFlyToCart.ts (1),
  scripts/test-auth-regressions.cjs (6). Không sửa ngoài phạm vi/tắt rule.
- npm ls --depth=0 xác nhận các dependency cần có; exit1 vì hai mục WASM optional
  extraneous trong node_modules (@emnapi/runtime, @img/sharp-wasm32). Không prune
  hoặc xóa gói ngoài phạm vi khi dev server có thể đang dùng. Manifest/lock khớp.
- Test VM cũ được bổ sung import/mock Firebase mới; giữ nguyên assertion profile
  thiếu phải lỗi và không lấy role từ metadata. Không bỏ/skip test.
- tests/backend-integration.test.mjs gọi component/hook/service/route thật, mock
  Supabase/Firebase/network/DOM. Bao phủ provider nesting, account sections,
  props login, logout lock/coalescing/cleanup/retry/owner change, optional push,
  recipient filtering/dedupe, Origin/identity/validation, API dev-only, admin sender.

Không có OAuth thật, push thật, UI/camera/browser thật hay DB integration mới.
Không đọc/sửa/copy env thật, không chạy API ghi, SQL, migration hoặc restart server.

## Phụ thuộc triển khai và kiểm thử thủ công

- Firebase Web/VAPID và Firebase Admin cần cấu hình thật trong môi trường chạy;
  sample có tên không chứng minh cấu hình đã hợp lệ. Không tự thay env/restart.
- user_push_tokens được code backend tham chiếu; types hiện tại chưa khai báo bảng.
  Chưa xác minh schema/quyền bảng này trên Supabase thật; API lỗi sẽ trả an toàn.
  Không tự tạo bảng hoặc cấp quyền. Người quản lý DB cần đối chiếu definition đã có.
- Giữ các phụ thuộc QR/bank-default/RPC chưa áp dụng đã ghi trong tài liệu seller;
  merge code không chứng minh DB đã triển khai các SQL đó.
- Sau khi tự commit, kiểm tra bằng tài khoản test: Google/Zalo login; /account có
  cả tham gia quán và thông báo; seller menu/dashboard/quán/lịch/bank vẫn đúng user;
  logout khi chưa bật push; khi có cấu hình và dữ liệu test được phép thì enable,
  foreground/background, disable, logout, đổi account/tab và lỗi cleanup/retry.
  Không gửi push tới tài khoản thật hoặc thử dữ liệu ngoài quyền trong lượt merge.
- Kết quả cuối cần không unmerged/marker, các file tích hợp đã staged. Merge vẫn
  chờ người dùng kiểm tra rồi git commit, không push tự động.
