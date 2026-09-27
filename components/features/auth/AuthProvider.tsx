"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getAuthErrorMessage,
  subscribeAuthProfile,
} from "@/services/auth.service";
import { useAuthStore } from "@/store/useAuthStore";

export default function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const setUser = useAuthStore((state) => state.setUser);
  const setError = useAuthStore((state) => state.setError);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void Promise.resolve()
      .then(() => {
        if (!active) return;

        const currentUrl = new URL(window.location.href);

        if (
          currentUrl.pathname === "/auth/callback" &&
          currentUrl.searchParams.has("error")
        ) {
          setError(
            "Đăng nhập chưa hoàn tất hoặc đã bị hủy. Vui lòng thử lại.",
          );
          return;
        }

        unsubscribe = subscribeAuthProfile(
          (profile) => {
            if (active) setUser(profile);
          },
          (message) => {
            if (active) setError(message);
          },
        );
      })
      .catch((error: unknown) => {
        if (active) {
          setError(getAuthErrorMessage(error));
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [setUser, setError]);

  const needsOnboarding =
    status === "ready" &&
    user !== null &&
    !user.phone?.trim();

  const isCompletionPage =
    pathname === "/auth/callback" ||
    pathname === "/auth/onboarding";

  const mustRedirect = needsOnboarding && !isCompletionPage;

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