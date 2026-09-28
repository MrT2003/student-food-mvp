"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AuthProvider from "@/components/features/auth/AuthProvider";
export default function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Public home is a fixed-data UI preview; other routes retain authentication.
  // Chỉ dùng trong giai đoạn UI mock, chưa tải dữ liệu tài khoản thật.
  if (
    pathname === "/" ||
    pathname === "/account" ||
    pathname === "/explore" ||
    pathname === "/cart" ||
    pathname === "/cart/confirm" ||
    pathname === "/cart/success" ||
    pathname.startsWith("/restaurants/")
  ) {
    return children;
  }
  return <AuthProvider>{children}</AuthProvider>;
}
