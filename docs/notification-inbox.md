# Notification inbox

## Triển khai

1. Chạy `supabase/migrations/202611230001_notification_inbox_indexes.sql` trong Supabase SQL Editor (sau các migration notification/outbox cũ). File có thể chạy lại; chỉ thêm index và default is_read=false, không drop dữ liệu.
2. Deploy/restart app. Không cần secret/env mới; API dùng session và admin client hiện có, luôn lọc user_id từ session.
3. Service worker mới cần được browser activate. Khi test, đóng tất cả tab/PWA của origin rồi mở lại. Popup được tạo bởi worker cũ không có notificationId nên không thể đánh dấu đọc qua click; hãy tạo một thông báo mới.

## Luồng

- Worker hiện có vẫn tạo notifications độc lập với FCM token. Không đổi transaction đơn hàng/fanout trong thay đổi này.
- GET /api/notifications/inbox: chỉ badge; ?list=1: 20 dòng mới nhất + badge; cursor(created_at,id) tải tiếp.
- POST /api/notifications/inbox: {id} hoặc {all:true}. Chỉ sửa is_read của tài khoản trong session; gọi lặp an toàn, trả số chưa đọc.
- Owner/staff/student dùng chung inbox, mỗi người nhận có dòng riêng. Owner đọc không ảnh hưởng staff.
- Cache RAM theo user, TTL60s; cùng request đang chạy được chia sẻ. GET/POST chạy tuần tự để tránh response cũ ghi đè.
- FCM hợp lệ làm cache cũ; gom1s để đọc lại badge, nếu dropdown mở thì đọc cả trang đầu. Không polling.
- Bấm xem thông báo/toast lưu đã đọc. Bấm popup OS mang ID tới trang đích; trang có session đúng người nhận mới gọi API.
- UI chỉ chuyển đã đọc sau khi server lưu thành công. Có lỗi sẽ hiển thị thông báo, không giả lập đã lưu. Người dùng có thể mở chuông và bấm lại.
- Toast tự đóng sau8s thời gian hiển thị; hover/focus/tabẩn tạm dừng. Đóng hoặc timeout không đánh dấu đọc.
- Popup OS để requireInteraction=false; thời gian đóng phụ thuộc nền tảng, không cam kết8s.

## Kiểm tra thủ công

1. Buyer chưa bật push: seller accept; sau worker chạy, buyer mở chuông thấy thông báo chưa đọc.
2. Bấm thông báo → vào đúng đơn; kiểm tra notifications.is_read=true; reload vẫn đã đọc.
3. Seller/staff nhận đơn mới; mở notification tới /seller/orders. Đọc trên một account không làm account kia đã đọc.
4. Bật push và tạo sự kiện mới: toast hiện, badge đồng bộ; chờ8s toast đóng nhưng badge không giảm. Hover/focus để kiểm tra tạm dừng.
5. Bấm X không đổi is_read. Bấm Xem đơn hàng lưu is_read; bấm lại không giảm thêm.
6. Network DevTools: bấm chuông liên tục không tạo GET mới trong60s. FCM mới bỏ qua TTL, các message gần nhau gom1s.
7. Tạo hơn20 thông báo, Xem thêm không trùng/mất dòng có cùng created_at.
8. Đổi account trong lúc GET đang chờ: response user cũ không đi vào UI user mới.
9. Background/đóngtab: bấm popup mới → đúng origin và đơn; is_read lưu khi trang đăng nhập đúng người nhận. Sai account không đọc hộ.
10. Giả lập lỗi POST: UI báo chưa lưu; fetch lại không biến notification thành đã đọc giả.

## Giới hạn

- Không realtime/polling: thiết bị khác đọc hoặc user không bật FCM có thể chỉ thấy cập nhật lúc fetch tiếp theo.
- Badge và trang danh sách được query riêng nên có thể lệch tạm thời nếu sự kiện xảy ra giữa hai query; lần đồng bộ sau sửa lại.
- Cache frontend giảm request hợp lệ, không phải cơ chế rate-limit chống client cố tình spam.
- Không thay đổi RLS/policy cũ của notifications. Endpoint server bảo vệ theo session/user_id; cần audit policy hiện có riêng nếu browser được cấp quyền ghi trực tiếp.
