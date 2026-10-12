"use client";

import type { ReactNode } from "react";
import AuthProvider from "@/components/features/auth/AuthProvider";

export default function AppProviders({ children }: { children: ReactNode }) {
  // Luôn luôn bọc AuthProvider để đồng bộ dữ liệu User toàn hệ thống
  return <AuthProvider>{children}</AuthProvider>;
}

