"use client";

import type { FirebaseOptions } from "firebase/app";
import type { MessagePayload, Messaging } from "firebase/messaging";

// Đây là cấu hình Firebase WEB công khai, không phải credentials của Firebase Admin.
// Không đặt private key/service-account JSON/server key trong file client này.
function readWebConfig(): FirebaseOptions {
  // Truy cập từng env trực tiếp để Next.js thay giá trị tại build time.
  const fields = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
  };
  for (const [name, value] of Object.entries(fields)) {
    if (!value) throw new Error(`Thiếu cấu hình ${name}.`);
    // Chỉ báo tên env, tuyệt đối không đưa giá trị cấu hình vào log/lỗi.
    // Đây là chặn nhầm lẫn cơ bản, không thể thay thế việc giữ secret ngoài client bundle.
    if (value.includes("PRIVATE KEY") || value.startsWith("{")) {
      throw new Error(`${name} phải là cấu hình Web, không phải private key/service-account JSON.`);
    }
  }
  return {
    apiKey: fields.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: fields.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: fields.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: fields.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

// Dùng chung instance trong browser, tránh initialize nhiều lần khi component render lại.
let messagingPromise: Promise<Messaging> | undefined;

const WORKER_PATH = "/firebase-messaging-sw.js";
// Scope riêng cho push để không thay thế worker PWA/cache ở scope / trong tương lai.
// FCM nhận registration trực tiếp nên không cần worker điều khiển page hiện tại.
const WORKER_SCOPE = "/firebase-cloud-messaging-push-scope/";
let registrationPromise: Promise<ServiceWorkerRegistration> | undefined;

// Chờ đúng registration của FCM, không dùng navigator.serviceWorker.ready vì nó
// có thể chờ worker điều khiển page hoặc trả registration của worker khác.
function waitForActiveWorker(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    const observed = new Set<ServiceWorker>();
    // expectedURL là URL được tạo dẫn tới file chưas đoạn code firebase-
    const expectedUrl = new URL(WORKER_PATH, window.location.origin).href;
    // cleanUp xóa toàn bộ eventListener và timer để tránh gây memory leakage
    const cleanup = () => {
      clearTimeout(timer);
      registration.removeEventListener("updatefound", check);
      observed.forEach((worker) => worker.removeEventListener("statechange", check));
    };
    const fail = (message: string) => { cleanup(); reject(new Error(message)); };
    const check = () => {
      const active = registration.active;
      // Kiểm tra woker đã ở trạng thái activated chưa
      if (active?.state === "activated") {
        // Nếu dã activated, kiểm tra đường link hiện tại có map với URL
        // chứa đoạn code firebase-worker được khai báo phía trên chưa
        if (active.scriptURL !== expectedUrl) {
          fail("Scope thông báo đang dùng một Service Worker khác.");
        } else {
          cleanup();
          resolve(registration);
        }
        return;
      }
      // Cài mới: installing -> installed -> activating -> activated.
      // Theo dõi cả waiting/active để không bỏ sót chuyển trạng thái giữa các callback.
      const workers = [registration.installing, registration.waiting, active];
      for (const worker of workers) {
        if (worker && !observed.has(worker)) {
          observed.add(worker);
          // Đăng kí một listener cho worker, mỗi khi state thay đổi thì tự động gọi
          // lại hàm check
          worker.addEventListener("statechange", check);
        }
      }
      if (!workers.some(Boolean) && [...observed].some((worker) => worker.state === "redundant")) {
        fail("Service Worker cài đặt thất bại. Kiểm tra cấu hình Firebase và kết nối tải SDK.");
      }
    };
    // Không treo UI vô hạn nếu cài worker thất bại hoặc đang chờ phiên cũ đóng.
    const timer = setTimeout(() => fail("Chờ kích hoạt Service Worker quá lâu. Vui lòng thử lại."), 30_000);
    registration.addEventListener("updatefound", check);
    check();
  });
}

// Đăng kí worker
async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  // Nếu hiện tại không có yêu cầu đăng kí worker mới nào tồn tại
  if (!registrationPromise) {
    registrationPromise = (async () => {
      // Kiểm tra trình duyệt có hỗ trợ firebase
      if (!(await isBrowserSupported())) throw new Error("Trình duyệt chưa hỗ trợ FCM Web hoặc kết nối chưa an toàn.");
      // Phát hiện cấu hình thiếu trước khi bắt browser tải worker.
      readWebConfig();
      const registration = await navigator.serviceWorker.register(WORKER_PATH, {
        scope: WORKER_SCOPE,
        updateViaCache: "none", // Kiểm tra bản worker/config mới, không dùng HTTP cache cũ.
      });
      return waitForActiveWorker(registration);
    })().finally(() => {
      // Chỉ gom các lời gọi đồng thời; lần sau kiểm tra lại thay vì giữ registration đã bị unregister.
      registrationPromise = undefined;
    });
  }
  return registrationPromise;
}

// Kiểm tra trình duyệt có hỗ trợ FIREBASE CLOUD MESSAGING không
async function isBrowserSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.isSecureContext) return false;
  const sdk = await import("firebase/messaging");
  return sdk.isSupported();
}

// Trả về Firebase Cloud Messaging Client
async function getMessagingClient(): Promise<Messaging> {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      if (!(await isBrowserSupported())) throw new Error("Trình duyệt này chưa hỗ trợ FCM Web trong ngữ cảnh hiện tại.");
      // Import SDK khi thực sự dùng, không khởi tạo Messaging lúc SSR/import module.
      const [appSdk, messagingSdk] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
      const config = readWebConfig();
      const name = "student-food-mvp-msg-push";
      const app = appSdk.getApps().find((entry) => entry.name === name)
        ?? appSdk.initializeApp(config, name);
      return messagingSdk.getMessaging(app);
    })().catch((error: unknown) => {
      messagingPromise = undefined; // Cho phép thử lại nếu khởi tạo thất bại.
      throw error;
    });
  }
  return messagingPromise;
}

export const FirebaseService = {
  isBrowserSupported,
  registerServiceWorker,

  // Gọi sau requestPermission() thành công: đăng ký -> chờ active -> lấy token.
  // Hàm này không tự xin quyền và chưa lưu token lên database.
  async registerAndGetToken(): Promise<string> {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      throw new Error("Vui lòng cho phép nhận thông báo trước khi đăng ký thiết bị.");
    }
    const registration = await registerServiceWorker();
    return FirebaseService.getRegistrationToken(registration);
  },

  // Gọi trực tiếp từ nút "Bật thông báo", không gọi tự động trong useEffect.
  // Không await công việc khác trước requestPermission để giữ thao tác chủ động của user.
  async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === "undefined" || !window.isSecureContext || !("Notification" in window)) {
      throw new Error("Thông báo cần browser hỗ trợ và HTTPS (hoặc localhost).");
    }
    if (Notification.permission !== "default") return Notification.permission;
    // Chỉ gọi prompt từ tương tác thực, trước mọi await; không auto-prompt khi mount.
    if (navigator.userActivation && !navigator.userActivation.isActive) {
      throw new Error("Hãy bấm Bật thông báo để cấp quyền.");
    }
    return Notification.requestPermission();
  },

  // Nhận registration đã active từ registerServiceWorker().
  // Không tự đăng ký một file SW chưa tồn tại; không tự bật hộp thoại xin quyền.
  async getRegistrationToken(registration: ServiceWorkerRegistration): Promise<string> {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      throw new Error("Người dùng chưa cho phép nhận thông báo.");
    }
    if (registration.active?.state !== "activated") throw new Error("Service Worker chưa được kích hoạt.");
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
    // VAPID PUBLIC key là khóa P-256 uncompressed mã hóa base64url (65 bytes).
    if (!vapidKey || !/^[A-Za-z0-9_-]{87}$/.test(vapidKey)) {
      throw new Error("NEXT_PUBLIC_FIREBASE_VAPID_KEY không đúng định dạng public key.");
    }
    const decoded = atob(vapidKey.replace(/-/g, "+").replace(/_/g, "/") + "=");
    if (decoded.length !== 65 || decoded.charCodeAt(0) !== 4) throw new Error("VAPID public key không hợp lệ.");
    const messaging = await getMessagingClient();
    const { getToken } = await import("firebase/messaging");
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) throw new Error("FCM chưa cấp token cho thiết bị này.");
    // Không log token. Bước sau gửi token lên API có xác thực để gắn với Supabase user.
    return token;
  },

  // Chỉ nhận khi trang đang mở; background push phải xử lý trong Service Worker.
  // Hàm trả unsubscribe: component cần gọi nó khi unmount.
  async onForegroundMessage(callback: (payload: MessagePayload) => void): Promise<() => void> {
    const messaging = await getMessagingClient();
    const { onMessage } = await import("firebase/messaging");
    return onMessage(messaging, callback);
  },

  // Hủy token của browser hiện tại. Backend vẫn cần xóa liên kết token/user khi đăng xuất.
  async deleteRegistrationToken(): Promise<boolean> {
    const messaging = await getMessagingClient();
    const { deleteToken } = await import("firebase/messaging");
    return deleteToken(messaging);
  },
};
