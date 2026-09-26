import type { Metadata } from "next";
import type { ReactNode } from "react";
import AuthProvider from "@/components/features/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudentFood",
  description: "Đặt món ngon quanh khu ký túc xá cùng StudentFood.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}