# Liên kết Google → Zalo

## Triển khai

1. Chạy toàn bộ `supabase/migrations/202610060001_zalo_account_links.sql` trong SQL Editor của **cùng project Supabase mà web đang dùng**, một lần, trước khi chạy code mới. Migration thêm bảng và hai RPC, không gộp hoặc xóa user cũ.
2. Giữ cấu hình server `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ZALO_APP_ID`, `ZALO_SECRET_KEY`. Không đưa service role vào biến `NEXT_PUBLIC_*`.
3. Callback dev: `ZALO_CALLBACK_URL_DEV`; production: `ZALO_CALLBACK_URL_PRODUCT`. URL kết thúc bằng `/api/auth/zalo/callback`, đúng origin người dùng mở và đúng URL đã đăng ký với Zalo. Khởi động lại dev server sau khi đổi env.
4. Gen lại database types sau khi migration đã chạy. Code dùng client hiện có nên không sửa tay file types được gen.

Nếu chưa chạy migration, API liên kết báo chưa sẵn sàng và đăng nhập Zalo mới sẽ bị chặn ở bước tra cứu danh tính. Triển khai SQL trước code. Các phiên Google đang hoạt động không bị thay đổi.

## Cấu trúc dữ liệu bổ sung ERD

`user_zalo_identities`: `zalo_id` (text, PK), `user_id` (UUID, UNIQUE, FK → auth.users.id), `created_at` (timestamptz).

Mỗi Zalo chỉ thuộc một user; mỗi user chỉ có một Zalo. `public.users.id` và tất cả dữ liệu đơn hàng, cửa hàng, vai trò vẫn giữ nguyên. Google tiếp tục do Supabase Auth quản lý; đây là liên kết Zalo do ứng dụng quản lý, không chèn tay vào `auth.identities`.

RLS chỉ cho user đọc hàng của chính họ. Client không được insert/update/delete hoặc gọi hai RPC tra cứu/liên kết. Chỉ server với service role thực hiện sau khi xác minh OAuth. SQL kiểm tra xung đột với cả tài khoản Zalo cũ có email `<zalo_id>@zalo.app`.

## Luồng

- Google → Account → “Liên kết Zalo”: POST cùng origin, kiểm tra session Google và hồ sơ active.
- Lưu cookie HttpOnly có chữ ký, state, PKCE, user ID và hạn 10 phút. Callback đòi cùng user đang đăng nhập, trao đổi code và lấy ID từ API Zalo; không nhận Zalo ID do frontend gửi.
- SQL ghi liên kết nguyên tử. Hủy OAuth hoặc đổi phiên không ghi liên kết. Xung đột trả thông báo, không tự gộp tài khoản.
- Sau khi đăng xuất, đăng nhập Zalo tra cứu liên kết để lấy đúng Auth user ID cũ. Server dùng `admin.generateLink` và `verifyOtp` để tạo session cho user đó sau khi xác minh Zalo. Không gửi email, không thay mật khẩu Google, không trả OTP/token ra UI.
- Callback Google giữ hồ sơ hiện có (không reset tên, avatar, vai trò hoặc trạng thái mỗi lần login).

Đây là phương thức đăng nhập dự phòng, không phải MFA, và không khôi phục tài khoản Google/Zalo tại nhà cung cấp. Nếu mất cả hai phương thức thì cần quy trình hỗ trợ riêng. Luồng ngược Zalo → liên kết Google, hủy liên kết và gộp hai tài khoản đã có dữ liệu chưa nằm trong thay đổi này.

## Kiểm thử

Chạy local: `node scripts/test-auth-regressions.cjs`, `npx tsc --noEmit --incremental false`.

Sau khi chạy SQL, test trên tài khoản thử:

1. Đăng nhập Google, ghi lại user ID, tên, SĐT, vai trò và đơn hàng. Liên kết một Zalo chưa thuộc tài khoản StudentFood khác. Account phải hiện cả hai “Đã liên kết”.
2. Đăng xuất; đăng nhập Zalo vừa liên kết. User ID và dữ liệu phải giống bước 1, không tạo hồ sơ thứ hai. Đăng xuất và đăng nhập Google lại vẫn giữ dữ liệu.
3. Hủy ở màn hình Zalo: không tạo liên kết. Quá 10 phút hoặc đổi tài khoản trình duyệt trước callback: từ chối liên kết.
4. Dùng Zalo đã có tài khoản StudentFood riêng hoặc thuộc Google khác: báo xung đột, không đổi owner và không gộp đơn hàng.
5. Hai callback đồng thời nhận cùng Zalo: chỉ một owner được lưu. Hai Zalo khác nhau liên kết vào cùng user: chỉ một liên kết thành công.
6. Đăng nhập Zalo cũ chưa có hàng mapping: giữ Auth user ID cũ và tạo mapping; không reset hồ sơ/role. Tài khoản bị khóa không đăng nhập được qua luồng Zalo.
7. Với anon/authenticated, thử gọi RPC liên kết hoặc tự insert/update bảng: phải bị từ chối. User A không đọc được liên kết của B.
8. Reload Account, kiểm tra badge từ DB; query URL `?zalo_link=success` tự nhập không được làm badge thành “Đã liên kết”.

SQL/RLS và OAuth thật cần kiểm thử trên Supabase triển khai; bộ test local dùng giả lập và không thay thế các bước trên.

Tham khảo API dùng trong server:
- https://supabase.com/docs/reference/javascript/auth-admin-generatelink
- https://supabase.com/docs/reference/javascript/auth-verifyotp
