"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AuthProvider from "@/components/features/auth/AuthProvider";
export default function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Public home is a fixed-data UI preview; other routes retain authentication.
  if (pathname === "/" || pathname === "/account") return children;
  return <AuthProvider>{children}</AuthProvider>;
}
