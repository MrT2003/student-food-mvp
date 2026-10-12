import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppProviders from "@/components/layout/AppProviders";
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
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
