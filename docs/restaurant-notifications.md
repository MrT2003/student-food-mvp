# Thông báo đơn mới cho quán

## Thông báo kết quả duyệt cho người đặt

Chạy migration `supabase/migrations/202611070001_student_order_notifications.sql` một lần sau migration outbox ban đầu. Không chạy lại migration tạo bảng cũ.

Trigger UPDATE orders tạo event `order_accepted`/`order_rejected` cùng transaction khi chuyển từ pending. Một đơn có thể có event đơn mới và event kết quả; UNIQUE(order_id,event_type) chống trùng. Worker hiện có tạo inbox/token deliveries cho student_id active; không yêu cầu quán còn mở hoặc active để thông báo kết quả đã commit. Payload student_order mở /orders/<orderId>. Không backfill đơn đã duyệt trước migration.

API duyệt gọi worker qua after() sau thành công; cron và retry/cleanup tiếp tục dùng chung. Staff đúng quán được qua precheck accept/reject; RPC accept_order/reject_order trên Supabase vẫn phải cấp quyền staff đúng quán và khóa order khi cập nhật. Migration notification không thay RPC phân quyền đó.

Test: bật push bằng tài khoản người đặt trước khi duyệt đơn; dùng owner hoặc staff cùng quán accept một đơn, reject một đơn khác. Xác nhận inbox/delivery event đúng loại, toast khi foreground và popup khi background; bấm mở đúng đơn. Thiết bị chưa bật push vẫn có inbox.

Test SQL cô lập: `node tests/student-order-notifications.sql.test.mjs`.

## Luồng đã implement

1. INSERT orders pending kích hoạt trigger ghi một event vào notification_outbox. Trigger không gọi HTTP. Cùng transaction với checkout nên order/order_items rollback thì event cũng rollback. Không cần thay RPC checkout đang chạy; không backfill đơn cũ.
2. Sau RPC checkout thành công, browser gọi POST /api/notifications/wake, header X-Order-Id. API xác thực user và đơn pending vừa tạo trong 60 giây thuộc user đó; after() xử lý batch sau response. Đây là fast path best-effort; tab đóng/mất mạng không mất event.
3. Cron gọi POST /api/internal/notifications/dispatch mỗi phút để phục hồi. API dùng Bearer secret riêng, không dùng session browser.
4. RPC claim lấy một slot chung bằng lease, fanout tối đa 5 event thành inbox notifications và deliveries. Người nhận là owner active và staff active của quán active; không dùng work_for_restaurant_id của seller. UNIQUE chống fanout trùng.
5. Claim tối đa 20 thiết bị có việc đến hạn. Gửi FCM ngoài transaction rồi ack theo lease_id. Thiết bị accepted không được claim lại trong các lượt bình thường. Dùng notification ID ổn định làm tag/dedupe.
6. Lỗi tạm thời retry với 60/120/240 giây + jitter 100–500 ms (cron quyết định thời điểm chạy thực tế). Tối đa 4 attempts gồm lần đầu. Token chết được cleanup nếu timestamp chưa đổi. Credential/payload sai chuyển failed để kiểm tra, không retry vô hạn.
7. Popup/toast mở /seller/orders bằng destination allowlist. API seller vẫn kiểm tra quyền; thông báo không cấp quyền truy cập đơn.

## Rollout trên Supabase/Vercel

1. Chạy toàn bộ `supabase/migrations/202611040001_restaurant_notification_outbox.sql` một lần trong SQL Editor. Migration có BEGIN/COMMIT; nếu lỗi, rollback rồi kiểm tra schema trước khi chạy lại. Yêu cầu đã có users, restaurants, orders, notifications và user_push_tokens. Không xóa/drop dữ liệu cũ.
2. Điền NOTIFICATION_WORKER_SECRET vào .env.local và Vercel Environment Variables, cùng các biến Firebase Admin/Supabase hiện tại. Secret tối thiểu 32 ký tự, sinh ngẫu nhiên; không commit.
3. Deploy code. Service worker được browser cập nhật theo lifecycle bình thường; khi test chuyển destination, đóng/mở lại tab nếu còn worker cũ.
4. Tạo job cron-job.org: URL `https://<domain>/api/internal/notifications/dispatch`; method POST; lịch mỗi phút; header `Authorization: Bearer <NOTIFICATION_WORKER_SECRET>`. Không thêm secret vào query string, không dùng Supabase service role hay Firebase private key làm header.
5. Endpoint cần truy cập được từ Internet. Nếu deployment có Vercel Deployment Protection, cấu hình quyền bypass phù hợp cho scheduler; không tắt xác thực worker. Không cấu hình Vercel Cron/pg_cron song song.
6. Worker maxDuration=25s, một batch rồi kết thúc. cron-job.org mặc định timeout 30s. 200 với busy=true là slot đang bận/cooldown; 503 cần kiểm tra cấu hình/migration/network. Kết quả failed/retry trong HTTP 200 vẫn cần theo dõi, không coi mọi HTTP 200 là gửi hết thành công.

Vercel Hobby chỉ phù hợp với sử dụng cá nhân phi thương mại theo điều khoản của Vercel; kiểm tra gói trước khi release thương mại. Tần suất mỗi phút khoảng 43.200 lần gọi/tháng 30 ngày, cộng fast path. Scheduler không loại bỏ tài nguyên DB cho claim/ack.

## Test localhost (không cần scheduler)

Chạy migration, restart `npm run dev`. Đăng nhập chủ quán ở browser A và staff active ở browser B, bật push. Dùng browser/profile khác đăng nhập sinh viên và checkout vào đúng quán. Fast path sẽ đánh thức worker. Cả owner và staff có inbox; chỉ thiết bị đã bật nhận push. Staff inactive/khác quán không nhận.

Để test cron bằng PowerShell, đặt secret thật vào biến môi trường của terminal rồi gọi (không paste secret vào screenshot/log):

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/internal/notifications/dispatch' -Headers @{ Authorization = "Bearer $env:NOTIFICATION_WORKER_SECRET" }
```

Next đọc .env.local nhưng PowerShell không tự đọc file đó. Có thể gọi cùng endpoint bằng HTTP client và đặt header riêng. Không đưa secret vào frontend hoặc DevTools của user.

Kiểm tra bằng SQL Editor:

```sql
select id, order_id, expanded, created_at, expires_at
from public.notification_outbox order by created_at desc limit 20;
select event_id, user_id, status, attempts, next_attempt_at, locked_until, last_error
from public.notification_deliveries order by updated_at desc limit 50;
select user_id, type, related_order_id, is_read, created_at
from public.notifications where type='restaurant_order_created'
order by created_at desc limit 30;
```

Gọi dispatcher hai lần liên tiếp: lần sau có thể busy; không tạo inbox trùng hoặc gửi lại delivery accepted. Test tắt push rồi đặt đơn: inbox vẫn được tạo, token đã gỡ không nhận. Test đổi staff sang quán khác trước claim: không gửi công việc đang pending cho staff đó.

Lỗi cấu hình đã sửa nhưng delivery đang failed: chỉ requeue ID cần thử lại qua SQL quản trị sau khi xác minh, không reset toàn bộ accepted. Không thử lỗi bằng cách xóa token người dùng thật; dùng fixture hoặc tài khoản test.

## Các giới hạn có chủ đích

- Lease 120s, cooldown slot 5s. Không có worker chạy liên tục trong RAM; một invocation chỉ xử lý 20 thiết bị. Khi chỉ có cron, tốc độ mặc định là tối đa 20 delivery/phút và fanout 5 event/phút. Chưa phải cấu hình phục vụ hàng nghìn đơn/giây; theo dõi backlog trước khi tăng batch/concurrency.
- Push đơn mới hết hạn sau 15 phút kể từ tạo event; bỏ qua đơn không còn pending khi claim. Inbox vẫn lưu thông báo lịch sử. FCM TTL tối đa 60s; thông báo đang trên đường tới vẫn có thể đến sau khi quán đã duyệt.
- Tập người nhận/token chụp ở lúc fanout; token bật sau không nhận push cũ. Quyền người nhận/token được kiểm tra lại khi claim retry. Có khoảng thời gian nhỏ giữa claim và gửi mà quyền có thể đổi: nội dung push chỉ là lời nhắc chung, không có tên/địa chỉ khách.
- Crash sau FCM accepted nhưng trước ack có thể gửi trùng. Tag/dedupe hạn chế trùng, không bảo đảm exactly-once.
- Event/delivery hoàn tất được dọn tối đa 100 event mỗi lượt sau 2 ngày. notifications giữ lại, không làm lịch sử biến mất; cần chính sách retention lịch sử riêng khi có dữ liệu thực tế.
- Chỉ có inbox DB, chưa thay UI danh sách notifications hiện có. Chưa nối sự kiện xác nhận/hủy/hoàn tất đơn cho sinh viên.
- Migration mới không tự chạy khi start Next.js; chưa áp dụng vào Supabase từ phiên coding này.

## Kiểm thử tự động

Node 24 trở lên, worker mock không gửi FCM thật:

```sh
node --test tests/notification-worker.test.mjs
```

Test SQL bằng PostgreSQL WASM (PGlite) riêng, không dùng env/DB thật, runtime ở cache ignored:

```sh
npm install --prefix node_modules/.cache/notification-sql-tests --no-audit --no-fund @electric-sql/pglite
node tests/notification-outbox.sql.test.mjs
```

Fixture SQL kiểm tra rollback, chọn người nhận, fanout, lease, retry từng token, cleanup, fencing, recovery, số lần thử và RPC permissions. Không thay thế kiểm thử schema/RLS thật sau rollout.
