# Hủy đơn đang chờ

Chạy `supabase/migrations/202611160001_student_cancel_order.sql` sau hai migration notification trước đó. Không chạy lại migration tạo bảng.

POST /api/orders/:orderId/cancel dùng session user và RPC cancel_pending_order. RPC kiểm tra user active, sở hữu đơn, khóa dòng FOR UPDATE và chỉ cho pending → cancelled. Gọi lại cancelled trả success mà không tạo event trùng. accepted/rejected/completed trả conflict. Outbox order_cancelled được insert cùng transaction; lỗi insert rollback hủy đơn.

Worker tạo inbox cho owner active của quán và delivery cho token đã đăng ký; không yêu cầu quán còn open. Bấm thông báo mở /seller/orders. Cron/lease/retry dùng chung. Không hoàn tiền tự động; nếu đã thanh toán trước cần quy trình hoàn tiền riêng.

Nút hủy có xác nhận, khóa khi request đang chạy. Chỉ cập nhật UI sau response thành công; lỗi/xung đột đọc lại trạng thái. API wake không quyết định kết quả hủy.

RPC accept_order/reject_order hiện triển khai ngoài các migration trong repo: cần giữ kiểm tra pending dưới cùng row lock hoặc conditional UPDATE. Nếu sửa RPC đó thành UPDATE vô điều kiện sau precheck, có thể ghi đè cancelled; notification outbox không sửa được lỗi transition này.

Test: người khác không hủy được; accepted không hủy được; hai request hủy không tạo event trùng; tạo đơn rồi hủy khi quán đóng; owner có push nhận thông báo, owner chưa bật vẫn có inbox. Test cạnh tranh thật: cùng lúc customer hủy và seller accept/reject, chỉ một thao tác thành công, thao tác còn lại conflict. SQL test cô lập: node tests/cancel-order.sql.test.mjs (không mô phỏng hai kết nối đồng thời).
