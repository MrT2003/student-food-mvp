# Gửi push từ server

## Cấu hình một lần

1. Firebase Console → Project settings → Service accounts → Generate new private key.
2. Lấy `project_id`, `client_email`, `private_key` từ JSON và điền ba biến `FIREBASE_ADMIN_*` trong `.env.local` theo `firebase.env.example`.
3. Project phải trùng project Firebase Web đang đăng ký token. Bật Firebase Cloud Messaging API (V1) cho project.
4. Khởi động lại Next.js. Trên hosting, lưu các giá trị bằng hệ thống secrets/environment của hosting.

Không đưa JSON service account vào repo hoặc `public/`. Không dùng `NEXT_PUBLIC_` cho các biến Admin; đặc biệt private key là secret. Service có `import "server-only"` để Next.js chặn import vào Client Component.

## Gọi từ nghiệp vụ server

```ts
import { FirebaseAdminService } from "@/services/firebase-admin.service";

// Chỉ chạy sau khi đã xác thực người thao tác, kiểm tra quyền sửa đơn,
// và transaction cập nhật trạng thái đơn đã commit thành công.
const result = await FirebaseAdminService.sendToUser({
  userId: order.student_id, // Lấy từ DB; không tin userId do browser gửi.
  orderId: order.id,
  notificationId: event.id, // UUID sự kiện; giữ nguyên nếu gửi lại cùng sự kiện.
  title: "Quán đã xác nhận đơn",
  body: "Đơn của bạn đang được chuẩn bị.",
});
```

Route sử dụng service này phải chạy Node.js (`export const runtime = "nodejs"`), không phải Edge. Đây chưa phải API công khai và chưa tự gửi khi trạng thái đơn thay đổi.

## Kết quả và lỗi

- Không có token: trả các bộ đếm bằng 0, không khởi tạo Firebase Admin.
- `accepted`: FCM chấp nhận gửi; không có nghĩa người dùng đã thấy/đọc.
- `failures`: mã lỗi từng registration ID, không chứa token.
- `removedTokens`: số token bị FCM xác nhận không hợp lệ đã xóa khỏi DB.
- `cleanupFailedIds`: gửi thất bại vì token chết nhưng xóa DB lỗi; xử lý cleanup riêng, không gửi lại thông báo thành công.
- `lookupFailed`: không đọc được một trang token; kết quả có thể chỉ bao gồm một phần thiết bị.
- Cấu hình sai, input sai hoặc user không active: throw lỗi mã hóa, không trả credential/lỗi SDK thô.

Service dùng data-only tương thích worker hiện tại và TTL một giờ. Không tự retry cả lượt gửi vì có thể gửi trùng tới thiết bị đã thành công. Outbox/worker là bước sau để retry chọn lọc; notification tag chỉ giúp thay thế thông báo cùng ID, không bảo đảm exactly-once.

Tài liệu: https://firebase.google.com/docs/cloud-messaging/send/admin-sdk

## Test bằng API development

Chạy `npm run dev`, đăng nhập và bật thông báo ở trang tài khoản. Mở DevTools → Console ngay trên origin ứng dụng và chạy:

```js
const response = await fetch('/api/notifications/test', {
  method: 'POST', credentials: 'same-origin',
});
console.log(response.status, await response.json());
```

Không cần body, token, hay userId. API gửi tới tất cả token đang lưu của tài khoản trong cookie. Endpoint chỉ chạy với `NODE_ENV=development`; `next start`/production trả 404. Giới hạn một lần/user/30 giây trong process dev (restart server reset giới hạn).

- `FCM_ACCEPTED`: FCM đã nhận, không chứng minh thiết bị đã hiển thị.
- `PARTIALLY_ACCEPTED`: có thiết bị thành công, có lỗi hoặc chưa đọc hết token; đừng tự gửi lại tất cả.
- `NO_TOKENS` (409): bật thông báo trước.
- `UNAUTHORIZED` (401): cần đăng nhập.
- `RATE_LIMITED` (429): chờ `retryAfterSeconds`.
- `SEND_FAILED` (502): xem `errorCodes`; không paste token/private key khi chia sẻ lỗi.
- `FIREBASE_ADMIN_*` (503): kiểm tra ba biến env và restart server.

Để test background, chạy đoạn sau rồi chuyển sang tab khác ngay (không đóng tab chứa timer):

```js
setTimeout(async () => {
  const response = await fetch('/api/notifications/test', { method: 'POST' });
  console.log(response.status, await response.json());
}, 5000);
```

Timer có thể bị browser trì hoãn ở nền. Khi app đang foreground, `useForegroundNotifications` nhận message và hiện toast trong trang (tối đa 3 toast, đóng thủ công). Worker background hiện popup hệ thống; bấm thông báo thử sẽ mở `/orders`.

Toast chỉ nhận payload có `recipientUserId` trùng user hiện tại và đăng ký push đang bật. Service Admin tự thêm field này; message cũ chưa có field sẽ bị bỏ qua ở foreground. Trong một tab, tối đa 200 notification ID gần nhất được giữ để chống trùng qua các lần chuyển trang/đóng toast. Đổi account hoặc logout sẽ xóa feed và gỡ listener. Đây không phải cơ chế exactly-once liên trình duyệt.

Để test đóng tab: bật thông báo ở browser A rồi đóng tab app (không logout, giữ browser chạy). Dùng browser/profile B đăng nhập cùng tài khoản, không cần bật push ở B, gọi API trên từ Console B. Không đặt timer trong tab rồi đóng tab đó vì timer sẽ mất. Việc thoát hẳn browser/OS là trường hợp riêng, không được bảo đảm giống đóng tab.
