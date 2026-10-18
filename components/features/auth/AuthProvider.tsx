"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AuthClientService,
  subscribeAuthProfile,
} from "@/services/auth.service";
import { useAuthStore } from "@/store/useAuthStore";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const setUser = useAuthStore((state) => state.setUser);
  const setError = useAuthStore((state) => state.setError);

  // 1. ALWAYS SYNCHRONIZE AUTH STATE (Run at every page)
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const currentUrl = new URL(window.location.href);

    if (
      currentUrl.pathname === "/auth/callback" &&
      currentUrl.searchParams.has("error")
    ) {
      setError("Đăng nhập chưa hoàn tất hoặc đã bị hủy. Vui lòng thử lại.");
    } else {
      unsubscribe = subscribeAuthProfile(
        (profile) => {
          if (active) setUser(profile);
        },
        (message) => {
          if (active) setError(message);
        }
      );
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [setUser, setError]);

  // 2. LOGIC ONBOARDING GUARD (Chỉ bắt buộc nhập SĐT khi cần)
  const needsOnboarding =
    status === "ready" &&
    user !== null &&
    !user.phone?.trim();

  // Các trang không bắt buộc phải nhảy sang Onboarding ngay lập tức
  const isBypassPage =
    pathname === "/auth/callback" ||
    pathname === "/auth/onboarding";
    // pathname === "/"; 

  const mustRedirect = needsOnboarding && !isBypassPage;

  useEffect(() => {
    if (mustRedirect) {
      router.replace("/auth/onboarding");
    }
  }, [mustRedirect, router]);

  if (mustRedirect) {
    return (
      <p role="status" className="p-6">
        Đang chuyển đến bước hoàn tất tài khoản...
      </p>
    );
  }

  return children;
}