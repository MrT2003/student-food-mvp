"use client";

import type { ReactNode } from "react";
import {SellerAccessProvider} from "@/components/features/seller/SellerAccessProvider";
import AuthProvider from "@/components/features/auth/AuthProvider";

export default function AppProviders({ children }: { children: ReactNode }) {
  // Luôn luôn bọc AuthProvider để đồng bộ dữ liệu User toàn hệ thống
  return <AuthProvider><SellerAccessProvider>{children}</SellerAccessProvider></AuthProvider>;
}

