/* global firebase */
// Classic Service Worker: không có window, React, localStorage hay process.env.
// Chỉ nhận push, không cache/intercept request của Next.js hoặc dữ liệu tài khoản.

// Chỉ mở trang đơn trong cùng origin; không chấp nhận URL tùy ý trong payload.
function orderUrl(orderId) {
  const validId = typeof orderId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  return new URL(validId ? `/orders/${encodeURIComponent(orderId)}` : "/orders", self.location.origin).href;
}

// Đăng ký trước khi import Firebase để handler của SDK không ghi đè thao tác click của app.
// Lắng nghe hành động click chuột vào hộp thoại thông báo nổi trên màn hình của người dùng
self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data;
  // Kiểm tra nguồn thông báo đến từ chính ứng dụng student-food hoặc
  // các thông báo gửi từ firebase, tránh việc bắt nhầm thông báo từ các trang
  // web khác chạy chung domain
  const ownNotification = data?.source === "student-food";
  // FCM_MSG là metadata của thông báo do Firebase tự hiển thị (notification payload).
  const firebaseMessage = data?.FCM_MSG;
  if (!ownNotification && !firebaseMessage) return;
  // Ngăn các hộp thoại thông báo khác cùng hiển thị đồng thời
  event.stopImmediatePropagation();
  // Thu hồi hộp thoại ngay lập tức sau khi người dùng bấm vào
  event.notification.close();
  // Tự động trích xuất mã đơn hàng  và tạo ra đường link URL tương ứng
  const url = orderUrl(ownNotification ? data.orderId : firebaseMessage.data?.orderId);
  event.waitUntil((async () => {
    // Scan toàn bộ các cửa sổ đang mở ứng dụng student-
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Kiếm cửa sổ có đường dẫn URL là đường URL tạo từ hàm orderUrl() phía trên
    // và mở cửa sổ đó
    const existing = windows.find((client) => client.url === url);
    // Nếu trang đó có tồn tại thì trình duyệt không load lại trang mà chỉ
    // dưa tab đó nổi lên trên màn hình để người dùng xem ngay lập tức
    if (existing) return existing.focus();
    // Nếu browser của user chưa truy cập vào trang có đường dẫn URL đã kiểm
    // tra phía trên thì tạo tab mới có đường dẫn là URL vừa tạo phía trên
    return self.clients.openWindow(url);
  })());
});

// Dynamic import vì worker nằm trong public  ---> File js / ts không được
importScripts("/api/firebase/worker-config");
importScripts("https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js");

firebase.initializeApp(self.FIREBASE_WEB_CONFIG);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Firebase đã tự hiển thị khi có notification; không showNotification lần nữa.
  if (payload.notification) return;

  // Quy ước data-only cho backend bước sau: title, body, orderId, notificationId đều là string.
  const data = payload.data || {};
  const title = typeof data.title === "string" && data.title.trim()
    ? data.title.slice(0, 120) : "StudentFood";
  return self.registration.showNotification(title, {
    body: typeof data.body === "string" ? data.body.slice(0, 500) : "Bạn có cập nhật mới về đơn hàng.",
    // Cùng notificationId thay thế thông báo cũ khi backend retry; không gộp mọi đơn vào một tag.
    ...(data.notificationId ? { tag: `student-food:${data.notificationId}` } : {}),
    data: { source: "student-food", orderId: data.orderId || null },
  });
});

// Không skipWaiting/claim cưỡng bức: để browser quản lý cập nhật worker theo lifecycle mặc định.
// Bước tiếp theo sẽ đăng ký worker và truyền registration active cho getRegistrationToken().
