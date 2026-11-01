import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Khởi tạo Firebase App (đảm bảo không bị khởi tạo lặp lại khi Next.js hot-reload)
export const firebaseApp = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

// Helper lấy instance Firebase Cloud Messaging an toàn trên trình duyệt (Client-side)
export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(firebaseApp);
};
