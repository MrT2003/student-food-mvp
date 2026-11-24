# Đăng nhập Zalo và liên kết Google

## Cài đặt trước khi dùng code mới

1. Database phải có migration `202610060001_zalo_account_links.sql` (mapping + hai RPC resolve/link).
2. Chạy toàn bộ `202610130001_auth_profile_and_contact_email.sql` trong Supabase SQL Editor.
3. Bật **Manual Linking** trong cấu hình Supabase Auth.
4. Cho phép redirect URL `/api/auth/google/callback` của localhost và production trong Supabase Auth (bao gồm query của flow link, bằng pattern redirect phù hợp môi trường).

Chưa có SQL nào được chạy lên Supabase từ lần sửa code này. Start Next.js không tự chạy migration.

Trước khi áp dụng migration, đọc các trigger Auth đang tồn tại trên database:

```sql
select t.tgname, pg_get_triggerdef(t.oid)
from pg_trigger t
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;
```

Migration chỉ thay trigger `sf_create_auth_public_profile`, không xóa trigger của dự án. Nếu có trigger khác tạo profile, cần thống nhất một nơi tạo profile trước khi triển khai; không xóa trigger Supabase một cách tùy tiện.

## Flow Zalo

- Callback xác minh cookie/state và OAuth, lấy profile từ Zalo.
- `resolve_zalo_user` tìm mapping trước, email `<zalo_id>@zalo.app` sau.
- Chưa có user: Auth Admin tạo user với random password (không dùng để đăng nhập) và `app_metadata.zalo_id` chỉ server được ghi.
- Trigger tạo `public.users` với role student, status active, name/avatar. Lỗi trigger rollback Auth insert.
- Không ghi mapping ở nhánh đăng ký hoặc đăng nhập Zalo độc lập.
- Nếu request đăng ký/link khác vừa thắng race: tra cứu lại user, không tự retry tạo tài khoản.
- Kiểm tra profile active rồi generateLink + verifyOtp để tạo cookie session. Không gửi email, không trả token ra client.
- Namespace email Zalo mới chỉ cho backend tạo; tránh browser đăng ký trước một email giả tương ứng Zalo ID.

## Liên kết hai chiều

- Google → Zalo: POST `/api/auth/zalo/link`, callback kiểm tra đúng user khởi tạo và gọi RPC liên kết.
- Zalo → Google: POST `/api/auth/google/link`, kiểm tra profile, lưu mapping trước rồi gọi `linkIdentity` trong session hiện tại.
- Cookie ký tên, nonce và UUID ràng buộc Google callback với lần liên kết; Supabase PKCE bảo vệ code exchange.
- Callback yêu cầu session trước/sau đều đúng UUID. Không tự gộp hai user đã tồn tại.
- Khi hủy Google, mapping có thể còn lại; không xóa vì mapping vẫn đúng.

## Email liên hệ

- Cột mới: `public.users.contact_email`, `contact_email_verified_at` (nullable).
- Zalo độc lập: NULL. Google: callback gọi RPC lấy email_verified từ `auth.identities` rồi đồng bộ.
- Không dùng user_metadata/frontend payload làm nguồn email đã xác minh; không dùng contact_email để resolve hoặc merge user.
- Trigger bảo vệ hai cột khỏi ghi trực tiếp bằng role anon/authenticated.
- Nếu liên kết Google thành công nhưng đồng bộ email lỗi: UI hiển thị trạng thái riêng và nút retry POST `/api/auth/google/contact`.
- Trigger tạo profile không tự chạy lại khi link identity vào user cũ; callback xử lý cập nhật email.

## Dữ liệu cũ

- Mapping cũ được giữ nguyên. Không tự xóa mapping của Zalo đã đăng ký trước đây.
- Password cũ không cần chuyển đổi.
- Profile thiếu sẽ bị từ chối đăng nhập (PROFILE_NOT_FOUND); migration không tự sửa user cũ hoặc reset tài khoản inactive.
- Email Google của user cũ sẽ đồng bộ khi đăng nhập Google hoặc dùng endpoint retry.
- Các hàm RPC/service-role chỉ gọi sau khi server xác minh OAuth/session; không cấp execute cho browser.

## Kiểm tra thủ công sau khi áp dụng migration

- Zalo mới: đúng một auth user + public user cùng UUID, không thêm mapping.
- Đăng nhập lại Zalo: UUID giữ nguyên, không thêm user hoặc mapping.
- Hai request đăng ký đồng thời: không tạo hai tài khoản.
- Trigger tạo profile lỗi: Auth không lưu user mới; kiểm tra trên project test.
- User inactive hoặc thiếu profile: không cấp session Zalo.
- Google → Zalo và Zalo → Google: đăng nhập lại bằng cả hai phương thức vẫn cùng UUID.
- Google/Zalo đã thuộc user khác: từ chối, không chuyển dữ liệu hay gộp tài khoản.
- Hủy OAuth, cookie hết hạn, đổi session giữa flow: không báo link thành công.
- Đồng bộ contact_email lỗi sau link: retry email, không lặp lại liên kết.

Không chạy test tự động hoặc OAuth thực tế trong lần triển khai này.

## Cập nhật 2026-10-16: hoàn tất liên kết sau OAuth

Phần này thay thế thứ tự ghi mapping trước OAuth ở hướng dẫn cũ phía trên.

- Chạy migration `202610160001_complete_google_link.sql` sau khi đã có bảng mapping và hai cột contact email. Migration này không tạo trigger Auth.
- `prepareGoogleLink` chỉ kiểm tra điều kiện, không insert mapping.
- Callback xác nhận Google identity/UUID rồi gọi `complete_google_link` bằng admin.
- RPC tự lấy Zalo ID từ mapping hiện có hoặc email Auth dạng Zalo; email liên hệ lấy từ Google identity đã xác minh.
- Insert mapping và cập nhật contact email cùng transaction. Lỗi một bước rollback cả hai; Google identity đã liên kết tại Supabase không bị rollback.
- Google-only dùng cùng RPC, chỉ đồng bộ contact email. Retry `/api/auth/google/contact` chạy lại toàn bộ bước hoàn tất, không bắt đầu OAuth mới.
- RPC cũ `sync_google_contact_email` có thể còn trên DB nhưng code Google không gọi nữa. Mapping cũ không bị xóa.
- Không đổi email Auth của tài khoản Zalo trước khi có mapping. Nếu callback bị đóng/mất phản hồi, đăng nhập Google lại sẽ chạy bước hoàn tất; khi nhận `contact_pending`, dùng nút Hoàn tất liên kết Google.
- Chưa chạy migration hoặc kiểm thử trên database trong lần sửa này.
