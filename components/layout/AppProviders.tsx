"use client";
import AuthProvider from "@/components/features/auth/AuthProvider";
import { ReactNode } from "react";
import ForegroundNotifications from "../features/notifications/ForegroundNotifications";

// Luôn luôn bọc AuthProvider để đồng bộ dữ liệu User toàn hệ thống
// Feed ở ngoài route tree nên chuyển trang không đăng ký listener lần nữa.
// Component tự ẩn và gỡ listener ngay khi logout hoặc đổi account.
// Feed ở ngoài route tree nên chuyển trang không đăng ký listener lần nữa.
// Component tự ẩn và gỡ listener ngay khi logout hoặc đổi account.
export default function AppProviders({ children }: { children: ReactNode }) {
  // Luôn luôn bọc AuthProvider để đồng bộ dữ liệu User toàn hệ thống
  return (
  <>
    <AuthProvider>{children}</AuthProvider> 
    <ForegroundNotifications />
  </>
  );
}
