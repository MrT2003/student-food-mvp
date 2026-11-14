# Cài StudentFood và bật push trên iOS

1. Dùng iPhone/iPad iOS 16.4 trở lên, mở origin HTTPS bằng Safari.
2. Chọn Chia sẻ → Thêm vào Màn hình chính. Mở từ icon StudentFood.
3. Đăng nhập nếu cần. Vào Tài khoản → Thông báo → Bật thông báo → Cho phép.
4. Dùng tài khoản khác đặt/duyệt đơn; thử cả khi app visible và khi về màn hình chính.
5. Bấm push phải mở chi tiết đơn trên cùng origin đã cài.

Manifest nằm ở /manifest.webmanifest, icon nằm ở /pwa/. Đường dẫn tương đối để không cố định hostname. Nếu đổi tunnel/domain cần cài và đăng ký push lại trên origin mới. Quyền trên Safari tab hoặc localhost không thay thế token của app cài trên HTTPS.

Không có cache offline hoặc worker thứ hai. Manifest không chứa secret, token, user ID. Service worker FCM hiện có tiếp tục xử lý push. Không auto-request permission khi mở app; nút Bật thông báo mới yêu cầu quyền, trình duyệt quyết định quyền thực tế. Phát hiện iOS/standalone chỉ để hướng dẫn UX, không phải ranh giới phân quyền. API tokens tiếp tục xác minh session, same-origin và owner; cài app/cấp quyền không cấp quyền xem đơn.

Kiểm thử quyền: cài mới và mở app không được tự hiện prompt; bấm Từ chối không tạo token; account khác không được gỡ token của user cũ; đăng xuất gỡ token theo cơ chế hiện có. Thiết bị không hỗ trợ hiển thị hướng dẫn thay vì cố đăng ký. Test thật trên iPhone là bắt buộc trước release; Focus/cài đặt hệ điều hành và mạng có thể ảnh hưởng việc hiển thị.
