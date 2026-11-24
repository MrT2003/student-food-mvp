# Zalo OAuth — contract hiện tại

Đối chiếu implementation, caller và lịch sử tại HEAD be15f4b. Commit 40083d6
hoàn thiện đăng nhập và liên kết hai chiều; docs/test từ phong (c3e8138)
còn mô tả bước lấy profile trước đó. Merge be15f4b không sửa các module Zalo.

- UI gọi AuthClientService.singInWithZalo → /api/auth/zalo/login bằng navigation.
- Login tạo state ngẫu nhiên và PKCE, lưu intent login/link trong cookie HMAC
  sf_zalo_flow, httpOnly, sameSite=lax, secure ở production, hạn 600 giây.
- Callback xác minh chữ ký, hạn và state; consume intent hợp lệ trước gọi provider.
  Link kiểm tra lại cùng user và Google identity; không fallback sang login.
- Login thành công gọi ZaloAccountService.loginWithVerifiedZalo: tìm/tạo Auth user,
  bổ sung profile độc lập khi đủ điều kiện, kiểm tra active, cấp session bằng
  generateLink/verifyOtp cho đúng UUID. Không chỉ trả JSON profile.
- Thành công redirect /; link redirect /account?zalo_link=success. Đổi session khi
  link trả session_changed; conflict trả conflict. Hủy/thiếu code redirect login
  hoặc account cancelled. Intent/state sai trả 400; lỗi login trả 500 an toàn.
- Callback luôn no-store/no-referrer. Không log upstream error, profile hoặc token.
- Provider giữ header access_token, timeout 10 giây, no-store, redirect=error;
  không retry đổi code. DTO nội bộ là id/name/img_url; name phải là string theo
  implementation/types hiện tại. Avatar chỉ nhận URL HTTP(S) không credential.
- Diagnostics chỉ chứa stage/kind/status/mã lỗi được allowlist, không payload.

Biến cần dùng: ZALO_APP_ID, ZALO_SECRET_KEY, ZALO_CALLBACK_URL_DEV,
ZALO_CALLBACK_URL_PRODUCT; signed flow và admin helper còn dùng
SUPABASE_SERVICE_ROLE_KEY. Không lấy cấu hình thật hoặc giá trị cookie/token để test.

Test tự động chạy module implementation thật trong VM; mock fetch, cookie jar,
Supabase/account boundaries và cấu hình giả trong VM. Loader chặn import app chưa
mock và fetch chưa mock. Kiểm tra callback chỉ chứng minh điều phối account service,
không chứng minh provisioning/session/RPC trên Supabase thật. Chưa kiểm thử OAuth
Zalo thật, quyền provider hoặc RLS/RPC đang triển khai; không có DB write thật.
