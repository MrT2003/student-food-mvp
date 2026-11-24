# StudentFood MVP — Tài liệu kỹ thuật

> Phạm vi: snapshot remote-tracking branch `origin/huy` tại commit
> `6bd3bad93bfb3f1503f27e7fb37d1ecd87aca2c7` (`6bd3bad`, 18/10/2026,
> `FE(Student): Doing mobile UI`).

## 1. Tổng quan

StudentFood là ứng dụng web đặt món cho sinh viên ở khu ký túc xá, gồm:

- **Student**: khám phá quán/món, chọn tùy chọn, quản lý giỏ nhiều quán,
  checkout, xem/theo dõi đơn và đặt lại đơn cũ.
- **Seller**: đăng ký cửa hàng, dashboard, quản lý đơn, menu, thông tin cửa hàng
  và phương thức thanh toán.

Hiện tại đây là **frontend MVP/hybrid prototype**, chưa phải hệ thống production:

- Authentication và cập nhật hồ sơ đã tích hợp Supabase phía trình duyệt.
- Catalog, giỏ, checkout và đơn student dùng fixture/Zustand, lưu `localStorage`.
- Phần lớn seller là UI preview, không ghi database.
- Contract đã sinh ở `types/database.types.ts`, nhưng không có migration SQL.
- `order.service.ts`, `notification.service.ts` rỗng; cart service là no-op.

## 2. Công nghệ và cấu hình

| Thành phần | Công nghệ | Phiên bản/ghi chú |
|---|---|---|
| Framework | Next.js App Router | `16.3.5` |
| UI runtime | React / React DOM | `19.2.8` |
| Ngôn ngữ | TypeScript | `^5`, strict, no-emit |
| State | Zustand | `^5.0.15` |
| Backend SDK | Supabase JS | `^2.109.0` |
| CSS | Tailwind + CSS Modules | Tailwind `^4` |
| Icon | Lucide React | `^1.47.0` |
| Quality | ESLint | ESLint `^9`, Next config `16.3.5` |
| Package manager | npm | Có `package-lock.json` |

Alias `@/*` trỏ vào gốc repository. `next.config.ts` giữ mặc định, chưa có
image domains, redirects, headers hoặc cache policy tùy chỉnh.

## 3. Kiến trúc và phân lớp

- `app/`: route, layout, metadata và route handler.
- `components/features/`: UI và tương tác theo domain.
- `components/layout/`: shell, navigation, provider, hydration boundary.
- `components/ui/`: component trình bày dùng lại.
- `lib/`: business rule, hook, mapper, view-model và fixture.
- `services/`: boundary truy cập Supabase hoặc adapter dữ liệu.
- `store/`: Zustand store cho auth, student demo và seller preview.
- `types/`: model nghiệp vụ và type sinh từ Supabase.
- `styles/`: CSS Module theo màn hình/feature.
- `scripts/`: regression test dạng Node script.
- `supabase/`: CLI config; chưa có migration/seed thực tế.

`page.tsx` chủ yếu là Server Component mỏng. Theo Next.js 16 cài trong dự án,
dynamic params là `Promise<...>` và được `await`. Component tương tác là Client
Component. `AppProviders` là client boundary cấp cao do dùng `usePathname`.

Route group `(student)` và `(seller)` chỉ tổ chức source, không đổi URL. Chỉ
student có layout chung; seller tự ghép sidebar trong từng view.

## 4. Bản đồ route

### 4.1 Student/public

| URL | View | Chức năng/nguồn dữ liệu |
|---|---|---|
| `/` | `HomeView` | Trang chủ, lọc quán, đặt lại nhanh; mock/store |
| `/explore` | `ExploreView` | Khám phá; mock catalog |
| `/explore/popular` | `PopularDishesView` | Món phổ biến; mock |
| `/restaurants/[slug]` | `RestaurantView` | Quán/menu qua mock service |
| `/restaurants/[slug]/menu/[itemId]` | `DishView` | Chi tiết, option, thêm giỏ |
| `/cart` | `CartView` | Giỏ theo quán |
| `/cart/confirm` | `OrderConfirmView` | Địa chỉ, payment/note từng quán |
| `/cart/success` | `OrderSuccessView` | Kết quả checkout gần nhất |
| `/orders` | `OrdersView` | Đơn đang xử lý |
| `/orders/history` | `OrderHistoryView` | Đơn kết thúc và reorder |
| `/orders/[orderId]` | `OrderDetailView` | Chi tiết đơn |
| `/orders/[orderId]/tracking` | `OrderTrackingView` | Timeline mô phỏng |
| `/account` | `AccountView` | Hồ sơ/bảo mật chủ yếu là preview |
| `/seller/register` | `SellerRegistrationView` | Form và session preview |

### 4.2 Seller

| URL | View | Trạng thái |
|---|---|---|
| `/seller` | `SellerOverviewView` | Dashboard/KPI mẫu |
| `/seller/orders` | `SellerOrdersView` | Fixture; transition trong memory |
| `/seller/menu` | `SellerMenuView` | CRUD/trạng thái trong memory |
| `/seller/menu/new` | `SellerMenuCreateView` | Tạo preview |
| `/seller/menu/[itemId]/edit` | `SellerMenuCreateView` | Sửa preview |
| `/seller/shop` | `SellerShopView` | Thông tin/lịch/token demo |
| `/seller/payments` | `SellerPaymentView` | Tiền mặt/ngân hàng demo |

### 4.3 Auth và API

| URL | Vai trò |
|---|---|
| `/auth/login` | Bắt đầu Google OAuth |
| `/auth/register` | Entry UI đăng ký |
| `/auth/onboarding` | Bổ sung tên/số điện thoại |
| `/auth/callback` | Client page hoàn tất auth |
| `/api/auth/callback` | Chuyển query sang callback bằng HTTP 303, no-store |

Dynamic restaurant/item pages gọi `notFound()` khi dữ liệu hoặc quan hệ
item–restaurant sai. Service hỗ trợ alias slug món cũ trong giai đoạn chuyển đổi.

## 5. Authentication và phân quyền

Luồng hiện có:

1. `signInWithGoogle` gọi Supabase OAuth Google với PKCE và callback API.
2. Route handler chuyển `code`/lỗi sang `/auth/callback`.
3. Client bật persist session, auto refresh và detect session trong URL.
4. `AuthProvider` nghe auth event rồi tải profile từ bảng `users`.
5. Profile phải active; thiếu phone sẽ được chuyển đến onboarding.
6. Onboarding gọi REST RPC `update_my_profile` và tải lại profile.

`useAuthStore` giữ user, trạng thái loading/ready/error và thông báo lỗi.
Service có mapping lỗi tiếng Việt và validation tên/số điện thoại.

### Giới hạn bảo vệ route

`AppProviders` bỏ qua auth provider cho nhiều route student/public. Các route
còn lại chỉ được bọc provider tải session và ép onboarding, không tự chặn người
chưa đăng nhập. `AuthGuard` có redirect và kiểm tra role nhưng **chưa có
consumer** trong app/components. Seller route vì vậy chưa được bảo vệ role ở UI.
Authorization thật phải đặt tại backend bằng RLS/RPC và kiểm tra ownership.

## 6. Luồng dữ liệu student

### 6.1 Catalog

`lib/mocks/catalog.mock.ts` là nguồn catalog demo chuẩn: restaurant, item,
option group và option. Các module home/explore chỉ chiếu dữ liệu này sang view
model. `restaurantService` lọc record active/available rồi trả
`structuredClone` để consumer không sửa fixture dùng chung.

### 6.2 Giỏ hàng

`useStudentMockStore` giữ `cart`, `cart_items`, `orderRecords`, địa chỉ,
payment/note từng quán, `lastCheckout` và trạng thái hydration.

Khi thêm món, store kiểm tra quán đang mở, món khả dụng, quantity nguyên 1–99,
option hợp lệ và giá dự kiến. Dòng cùng restaurant + item + `option_hash` được
gộp. `projectCart` dựng view hiển thị từ row và catalog, không tạo nguồn giá
thứ hai.

`cartSync` debounce snapshot nhưng `cartService.syncCart` chưa gửi HTTP. Bản
production cần sync atomic, reconcile dòng xóa, xác thực owner và tính giá phía
server.

### 6.3 Checkout và order

Checkout demo kiểm tra customer/cart/address, yêu cầu preference cho từng quán,
chia giỏ thành một order mỗi quán với chung `session_checkout_id`, chụp snapshot
tên/giá/option, sinh mã `SF-<restaurant>-<sequence>`, rồi commit order và xóa
giỏ trong một lần cập nhật. Không có request tạo đơn, thu tiền hoặc gửi seller.

Trạng thái gồm `pending`, `accepted`, `rejected`, `cancelled`, `completed`.
Reorder chỉ nhận đơn đã kết thúc của đúng customer, kiểm tra lại catalog và dùng
giá hiện tại. Toàn bộ dòng được chuẩn bị trước commit nên lỗi không tạo giỏ dở.

## 7. Persistence trình duyệt

### Student

- Storage: `localStorage`.
- Key: `student-food:mock:student:50000000-0000-4000-8000-000000000001:v1`.
- Payload version 1 gồm cart, items, orders, địa chỉ, preference và last checkout.
- Không lưu action, auth token hoặc bản sao view-model.

`StudentStorageBoundary` chỉ đọc storage sau mount để tránh hydration mismatch.
JSON hỏng, sai version/customer hoặc không map được catalog sẽ không bị ghi đè;
UI chuyển sang memory-only và cảnh báo. Lỗi quota giữ state trong memory và thử
lại ở thay đổi sau. Dữ liệu chỉ ở cùng browser/origin, chưa đồng bộ nhiều tab và
không phải nguồn đáng tin cậy.

### Seller

- Draft đăng ký dùng `sessionStorage`, key
  `student-food:seller-registration-preview:v1`.
- Menu, shop và payment store chỉ ở memory, phần lớn mất khi reload.
- Preview state không cấp role hoặc quyền truy cập.

## 8. Seller domain

- Registration: form/validation/preview; submit chỉ lưu draft trong session.
- Overview: dashboard cửa hàng mới và KPI mẫu.
- Orders: lọc/tìm kiếm/xem bill/transition trên fixture; không nhận order student.
- Menu: lọc, bật/tắt, nhân bản, xóa, thêm/sửa item/option trong memory.
- Shop: thông tin, lịch và delivery token giả; chưa gọi RPC tương ứng.
- Payments: cấu hình tiền mặt/ngân hàng trong memory, chưa ghi/xác minh DB.

## 9. Contract database Supabase

Generated type mô tả các bảng:

| Nhóm | Bảng |
|---|---|
| Người dùng/cửa hàng | `users`, `restaurants`, `restaurant_banks` |
| Catalog | `menu_items`, `menu_item_option_groups`, `menu_item_options` |
| Giỏ | `carts`, `cart_items` |
| Đơn | `orders`, `order_items` |
| Hệ thống | `notifications`, `reports` |

Enum: `user_role` gồm student/seller/staff; `order_status` gồm
pending/accepted/rejected/cancelled/completed; `payment_method_type` gồm cash
và bank transfer.

RPC contract gồm:

- Profile/security: `update_my_profile`, `change_app_lock_pin`,
  `verify_app_lock_pin`.
- Seller/staff: `register_seller`, `add_staff_by_phone`, `remove_staff`,
  `update_restaurant_profile`, operating status và reset delivery token.
- Cart/checkout: add/update/delete cart item và `create_checkout`.
- Order/delivery: get/accept/reject/cancel order và complete delivery.

Generated types không chứng minh RLS, trigger hay RPC body được version-control.
Không có migration; `config.toml` trỏ đến `seed.sql` nhưng file cũng vắng mặt.
Database local do đó chưa tái lập được chỉ từ repository.

## 10. Cài đặt và vận hành

Yêu cầu: Node.js tương thích Next.js 16.3.5, npm và Supabase project nếu thử auth.
Repository chưa pin Node bằng `engines` hay version file.

Tạo `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Đây là biến public cho browser; không đặt service-role key. Client từ chối cấu
hình thiếu hoặc chứa `placeholder`.

```bash
npm install
npm run dev
npm run lint
npm run build
npm run start
npm run update-types
```

`update-types` đang hard-code project ID `qpotdymeuxajrkmmeput` và dùng
`npx`; cần Supabase CLI/quyền project. Nên chuyển ID sang config môi trường.

Supabase local dùng PostgreSQL 17; port API 54321, DB 54322, Studio 54323, SMTP
54324 và analytics 54327. Auth site URL là `http://127.0.0.1:3000`; email signup
bật, confirmation tắt, anonymous sign-in tắt. Realtime, Storage và Edge Runtime
bật. Vì thiếu migration/seed, `supabase start` chưa tạo đúng contract ứng dụng.

## 11. Kiểm thử

Không có Jest/Vitest/Playwright; test chưa nằm trong npm scripts. Regression suite:

```bash
node scripts/test-cart-debounce.cjs
node scripts/test-option-selection.cjs
node scripts/test-seller-orders.cjs
node scripts/test-seller-preview.cjs
node scripts/test-student-storage.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run lint
```

Phạm vi gồm debounce sync, option/hash/pricing, seller order transition, seller
preview persistence, student storage, atomic checkout, historical snapshot, mã
đơn và reorder. Chưa có E2E, visual regression, API integration hoặc RLS test.
README vẫn là nội dung mặc định create-next-app.

## 12. UI và accessibility

- HTML dùng ngôn ngữ `vi`; thương hiệu `StudentFood`.
- Token màu: nền kem/trắng, chữ navy, accent cam `#ff4d12`.
- Hệ thống Typography sử dụng Google Fonts (nạp qua thẻ `<link>` trong `app/layout.tsx`): `"Be Vietnam Pro"` (`--font-body`) cho văn bản nội dung chung và `"Inter"` (`--font-display`) cho nội dung nổi bật (Headings, Title, Navigation Bar, tên thương hiệu `StudentFood`).
- Student layout có mobile viewport, safe viewport fit và bottom navigation.
- Styling theo CSS Module; Tailwind dùng cho một số utility.
- Có status/alert, label, dialog và aria ở nhiều luồng nhưng chưa có a11y test.

## 13. Rủi ro và khoảng trống

### Ưu tiên cao

1. **Authorization chưa hoàn chỉnh**: guard chưa được gắn; RLS không có trong repo.
2. **Student/seller không dùng chung order source**: checkout student không tạo
   order seller có thể nhận.
3. **Database không tái lập được**: thiếu migration, policy, RPC body và seed.
4. **Demo state không đáng tin cậy**: local data có thể bị sửa, không được dùng
   làm nguồn giá, ownership hay authorization production.

### Ưu tiên trung bình

5. Order/notification service rỗng; cart sync no-op.
6. Seller store phân tán và persistence không đồng nhất.
7. Auth redirect phía client; chưa có middleware/server gate.
8. Chưa có error/loading/not-found tùy chỉnh, observability hoặc logging cấu trúc.
9. Chưa có CI quality gate/test runner chuẩn; README chưa phản ánh dự án.
10. Next config chưa có production security headers/image policy.

## 14. Hướng phát triển

1. Version-control migration, RLS, RPC và seed; tạo local environment tái lập được.
2. Gắn route guard đúng role, đồng thời bảo vệ mutation bằng RLS/RPC.
3. Triển khai `StudentService` thật và thay dần catalog/cart/checkout/order mock.
4. Dùng chung order source cho student/seller; thêm realtime hoặc polling.
5. Nối seller mutation và upload ảnh qua Storage thay Data URL.
6. Thêm boundary validation, checkout idempotency và server-side pricing.
7. Đưa regression scripts vào CI; thêm Supabase integration, E2E và a11y test.
8. Chuẩn hóa error/loading/not-found, monitoring và tài liệu deploy.

## 15. Quy ước phát triển

- Đọc guide tương ứng trong `node_modules/next/dist/docs/` trước khi đổi API,
  convention hoặc cấu trúc Next.js của phiên bản hiện tại.
- Giữ page/layout mỏng; interaction ở feature, rule thuần ở `lib`, I/O ở
  `services`, shared state cần thiết ở `store`.
- Không tin ID, role, total hay price do client gửi lên.
- Catalog là nguồn giá demo; order-item snapshot là nguồn lịch sử sau checkout.
- Mutation nhiều bước phải validate hoàn tất trước khi commit.
- Đổi schema phải kèm migration và generated types mới.
- Phân biệt rõ mock, preview và production trong tên/module/UI.

## 16. Điểm vào quan trọng

| Mục tiêu | File |
|---|---|
| Root/provider | `app/layout.tsx`, `components/layout/AppProviders.tsx` |
| Student shell | `app/(student)/layout.tsx`, `StudentStorageBoundary.tsx` |
| Auth | `lib/supabase/client.ts`, `services/auth.service.ts`, `AuthProvider.tsx` |
| Student state | `store/useStudentMockStore.ts` |
| Catalog | `lib/mocks/catalog.mock.ts` |
| Cart rules | `lib/cart/options.ts`, `calculations.ts`, `view-model.ts` |
| Checkout/reorder | `lib/mocks/checkout.mock.ts`, `lib/orders/reorder.ts` |
| Restaurant adapter | `services/restaurant.service.ts` |
| Seller state | `store/useSellerMenuStore.ts`, `useSellerPreviewStore.ts`, `useSellerShopStore.ts`, `useSellerPaymentStore.ts` |
| Backend contract | `types/database.types.ts`, `types/student-service.types.ts` |
| Persistence notes | `docs/student-demo-storage.md` |

## 17. Typography inventory

### 17.1 Phạm vi, cấu hình Google Fonts và phân bổ sử dụng

Hệ thống Typography của toàn bộ ứng dụng (`app/`, `components/`, `styles/`) được cấu hình sử dụng **Google Fonts** thông qua cụm thẻ `<link>` trong `app/layout.tsx`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link
  href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
  rel="stylesheet"
/>
```

Hai biến CSS toàn cục được khai báo tại `app/globals.css` (`:root` và `@theme inline`):

- **Văn bản nội dung chung (Body text)**: `--font-body: "Be Vietnam Pro", sans-serif;` — áp dụng mặc định cho `body`, `.sf-auth`, các container `.page`, đoạn văn, mô tả, metadata, nhãn biểu mẫu, ô nhập liệu, bảng dữ liệu, thông báo và các thành phần kế thừa `font: inherit`.
- **Nội dung nổi bật (Headings, Title, Navigation Bar, Tên thương hiệu `StudentFood`)**: `--font-display: "Inter", sans-serif;` — áp dụng cho toàn bộ thẻ tiêu đề (`h1`–`h6`), các khối tiêu đề trang/section/card/modal/bill (`.title`, `.sectionTitle`, `.quantityLabel`, `.billTitle > strong`, `.orderCode button`), thanh điều hướng (`nav`, header links, mobile bottom navigation, checkout steps, seller sidebar navigation) và tên thương hiệu `StudentFood` (`.brand strong`, `AuthHeader`, `AuthIntro`, `SellerRegistrationView`, `.qrBrand`).
- **Quy ước đọc bảng**:
  - `Normal` ở cột Letter Spacing, Case hoặc Style nghĩa là trình duyệt giữ giá trị mặc định/kế thừa.
  - Kích thước có dấu `→` thể hiện biến thể responsive từ Desktop xuống Mobile viewport; `clamp(...)` được giữ nguyên khi sử dụng fluid typography.
  - Các độ đậm (`font-weight`) được chuẩn hóa theo dải trọng số chuẩn của Google Fonts `Inter` và `Be Vietnam Pro` (`400`, `500`, `600`, `700`, `800`), đảm bảo độ tương phản và khả năng đọc rõ ràng trên cả Desktop và Mobile.

### 17.2 Headings

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Heading / Hero Display | "Inter", sans-serif (`var(--font-display)`) | 800 | `clamp(28px, 3vw, 42px)` → `clamp(22px, 6–6.6vw, 32px)` | -0.8 đến -1.2px | 1.18–1.25 | Normal | Normal |
| Heading / Auth Display | "Inter", sans-serif (`var(--font-display)`) | 700–800 | `clamp(32px, 4.3dvh, 42px)` hoặc 36–48px | -0.025em (`tracking-tight`) đến -0.6px | 1.12–1.16 | Normal | Normal |
| Heading / Page Title | "Inter", sans-serif (`var(--font-display)`) | 800 | 32–42px → 22–34px (`clamp(28px, 3vw, 40px)`) | -0.6 đến -1.0px | 1.12–1.22 | Normal | Normal |
| Heading / Section Title | "Inter", sans-serif (`var(--font-display)`) | 700–800 | 20–28px → 16–24px | -0.4 đến -0.6px | 1.25–1.35 | Normal | Normal |
| Heading / Subsection | "Inter", sans-serif (`var(--font-display)`) | 600–700 | 15–20px → 14–18px | Normal đến -0.4px | 1.25–1.40 | Normal | Normal |
| Heading / Dialog Title | "Inter", sans-serif (`var(--font-display)`) | 700 | 20–26px → 20–23px | Normal đến -0.5px | 1.25–1.35 | Normal | Normal |

Nguồn tiêu biểu: `.hero h1`, `.pageHeading h1`, `.heading h1`, `.titleRow h1`, `.sectionHeading h2`, `.sectionTitle`, `.card h2`, `.dialog h2`, `.title` trong các CSS Module và các heading trong auth views.

### 17.3 Body

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Body / Large | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 18–22px → 15–17px | Normal | 1.45–1.55 | Normal | Normal |
| Body / Medium | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 15–17px → 14–15px | Normal | 1.45–1.50 | Normal | Normal |
| Body / Base | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 14–15px | Normal | 1.40–1.50 | Normal | Normal |
| Body / Small | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 12–13px | Normal | 1.35–1.50 | Normal | Normal |
| Body / Emphasis | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 600–700 | 14–18px | Normal | 1.35–1.50 | Normal | Normal |

### 17.4 Navigation

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Navigation / Desktop Link | "Inter", sans-serif (`var(--font-display)`) | 500; active 700 | 15–16px | -0.1px đến Normal | 1.40 | Normal | Normal |
| Navigation / Seller Sidebar | "Inter", sans-serif (`var(--font-display)`) | 500; active 700 | 15–16px → 12–13px | Normal | 1.35–1.50 | Normal | Normal |
| Navigation / Mobile Bottom | "Inter", sans-serif (`var(--font-display)`) | 500; active 700 | 12px | -0.1px | 1.25 | Normal | Normal |
| Navigation / Checkout Steps | "Inter", sans-serif (`var(--font-display)`) | 500; active 700 | 14–16px → 12–14px | Normal | 1.35–1.45 | Normal | Normal |
| Navigation / Brand (`StudentFood`) | "Inter", sans-serif (`var(--font-display)`) | 800 | 20–24px → 18–20px | -0.5 đến -0.6px | 1.15–1.20 | Normal | Normal |
| Navigation / Brand Tagline | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 11–13px → 10–11px | Normal | 1.25–1.35 | Normal | Normal |

### 17.5 Caption

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Caption / Helper | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 12–13px | Normal | 1.35–1.50 | Normal | Normal |
| Caption / Metadata | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 12–14px → 11–12px | Normal | 1.35–1.50 | Normal | Normal |
| Caption / Micro | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 9–11px | Normal | 1.20–1.35 | Normal | Normal |
| Caption / Demo Note | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 11–13px | Normal | 1.40–1.50 | Normal | Normal |
| Caption / Debug Code | Consolas, "Courier New", monospace | 400 | 12px (`text-xs`) | Normal | Normal | Normal | Normal |

### 17.6 Link

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Link / Standard | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400–500 | 14–17px | Normal | 1.40–1.50 | Normal | Normal |
| Link / Emphasis | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 600–700 | 14–17px | Normal | 1.40 | Normal | Normal, underline ở auth links |
| Link / Back | "Be Vietnam Pro" / "Inter" (sidebar `.back`) | 400–500 | 15–18px | Normal | 1.40–1.50 | Normal | Normal |
| Link / See All | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400–600 | 14–16px → 11–13px | Normal | 1.35–1.50 | Normal | Normal |

### 17.7 Button

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Button / Primary Large | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 600 | 18–21px → 16–18px | Normal | 1.30–1.40 | Normal | Normal |
| Button / Primary | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 600–700 | 15–17px → 14–16px | Normal | 1.30–1.40 | Normal | Normal |
| Button / Secondary / Outline | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 500–600 | 14–17px → 12–14px | Normal | 1.30–1.40 | Normal | Normal |
| Button / Compact | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 500–600 | 12–14px → 11–12px | Normal | 1.20–1.30 | Normal | Normal |
| Button / Social Auth | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 600 | 16px → 20px | Normal | 1.40 | Normal | Normal |

Các button trong CSS Modules kế thừa `font: inherit` từ `.page` (`var(--font-body)`); `components/ui/Button.tsx` giữ nguyên cấu trúc và class gốc theo ràng buộc hệ thống.

### 17.8 Card

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Card / Title | "Inter", sans-serif (`var(--font-display)`) | 700 | 20–24px → 16–21px | -0.4 đến -0.6px | 1.25–1.35 | Normal | Normal |
| Card / Item Title | "Inter", sans-serif (`var(--font-display)`) | 600–700 | 15–22px → 10–18px | Normal đến -0.4px | 1.25–1.40 | Normal | Normal |
| Card / Body | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 13–16px → 12–14px | Normal | 1.40–1.50 | Normal | Normal |
| Card / Metadata | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 11–15px → 10–13px | Normal | 1.35–1.50 | Normal | Normal |
| Card / KPI Value | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 700–800 | 25–29px → 14–20px | Normal đến -0.4px | 1.10–1.30 | Normal | Normal |

### 17.9 Status

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Status / Badge | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 500–600 | 10–16px → 10.5–13px | Normal | 1.20–1.50 | Normal | Normal |
| Status / Strong Label | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 600–700 | 13–18px | Normal | 1.35–1.50 | Normal | Normal |
| Status / Selector | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 600 | 11–12px | Normal | 1.35 | Normal | Normal |
| Status / Provider | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400; connected 600 | 13px | Normal | 20px | Normal | Normal |

Status được phân biệt chủ yếu bằng màu sắc và nền; nội dung giữ nguyên cách viết trong JSX.

### 17.10 Alert

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Alert / Inline Message | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 13–14px | Normal | 1.45–1.60 | Normal | Normal |
| Alert / Error Text | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 13–14px | Normal | 1.45–1.60 | Normal | Normal |
| Alert / Warning / Notice | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 12–15px | Normal | 1.40–1.60 | Normal | Normal |
| Alert / Success Copy | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 13–18px → 14–15px | Normal | 1.40–1.50 | Normal | Normal |
| Alert / Auth Error | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 14px (`text-sm`) | Normal | 1.625 (`leading-relaxed`) | Normal | Normal |

### 17.11 Footer

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Footer / Note | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 12px → 11–12px | Normal | 1.50; compact 1.20 | Normal | Normal |
| Footer / Form Label | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 700 | 15px → 13px | Normal | 19–21px | Normal | Normal |
| Footer / Form Control | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 14px → 13px | Normal | 19–21px | Normal | Normal |
| Footer / Action | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 500–600 | 14–16px | Normal | 1.30–1.40 | Normal | Normal |

### 17.12 Form

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Form / Label | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 600–700 | 14–17px → 12–15px | Normal | 1.30–1.45 | Normal | Normal |
| Form / Input | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 14–17px → 12.5–15px | Normal | 1.30–1.50 | Normal | Normal |
| Form / Select | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400–600 | 12–17px → 11–15px | Normal | 1.20–1.50 | Normal | Normal |
| Form / Textarea | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 14–15px → 12–14px | Normal | 1.35–1.50 | Normal | Normal |
| Form / Hint | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 12–14px → 11–13px | Normal | 1.30–1.50 | Normal | Normal |
| Form / Validation Error | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 13–14px | Normal | 1.40–1.60 | Normal | Normal |
| Form / Counter | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 12–13px → 11–12px | Normal | 1.00–1.35 | Normal | Normal |

### 17.13 Pricing

| Name | Typeface | Weight | Size | Letter Spacing | Line Height | Case | Style |
|---|---|---:|---|---|---|---|---|
| Pricing / Hero Price | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 800 | 32px → 28px | Normal | 40px → 35px | Normal | Normal |
| Pricing / Item Price | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 600–700 | 15–22px → 12–19px | Normal | 1.30–1.40 | Normal | Normal |
| Pricing / Subtotal | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400; value 700 | 15–19px; value 19–22px | Normal | 1.35–1.50 | Normal | Normal |
| Pricing / Grand Total | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 700–800 | 25–34px → 18–28px | Normal đến -0.7px | 1.15–1.35 | Normal | Normal |
| Pricing / QR Amount | "Be Vietnam Pro", sans-serif (`var(--font-body)`) | 400 | 15px | Normal | 1.35 | Normal | Normal |

### 17.14 Ngoại lệ và ghi chú kỹ thuật

- `components/buttons/AddToCartBtn.tsx` và `components/features/orders/orderTestPanel.tsx` là UI kiểm thử/debug nội bộ, có sử dụng `font-mono`, `uppercase`, `tracking-wider`, `text-xs`; không thuộc hệ thống typography chính của giao diện người dùng nhưng vẫn kế thừa ngữ cảnh chung khi không dùng `font-mono`.
- Trong `styles/seller-payments.module.css`, `.qrBrand` sử dụng `"Inter"` (`var(--font-display)`, weight `800`) cho cụm nhận diện VietQR, riêng `.qrBrand > span` dùng `font-style: italic` và `.qrBrand small` dùng `"Be Vietnam Pro"` (`var(--font-body)`).
- Các biểu tượng chữ cái đại diện (`.avatar`, `.zaloLogo`) được gán `"Inter"` (`var(--font-display)`, weight `700`) để đồng bộ hình học sắc nét với hệ thống tiêu đề và thanh điều hướng.
