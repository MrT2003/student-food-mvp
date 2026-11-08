"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  subscribeAuthProfile,
  isSigningOutHere,
} from "@/services/auth.service";
import { useAuthStore } from "@/store/useAuthStore";
import { enablePush } from "@/lib/firebase/pushLifecycle";
import RegisterView from "@/components/features/auth/RegisterView";
import AuthShell from "@/components/layout/AuthShell";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const logoutStatus = useAuthStore((state) => state.logoutStatus);
  const setUser = useAuthStore((state) => state.setUser);
  const setError = useAuthStore((state) => state.setError);
  const previousOwner = useRef<string | null>(null);
  const changedOwner = useRef(false);
  const [accountChanged, setAccountChanged] = useState(false);

  // Chỉ refresh đăng ký từng được bật. Không xin quyền và không bật lại sau disable/logout.
  useEffect(() => {
    if (!user?.id || accountChanged) return;
    let lastAttempt = 0;
    let running = false;
    const refreshPush = () => {
      if (running || Date.now() - lastAttempt < 5 * 60_000) return;
      running = true;
      lastAttempt = Date.now();
      void enablePush(user.id, true).catch(() => {
        // Lỗi mạng không làm hỏng đăng nhập; thử lại khi focus sau hoặc theo interval.
      }).finally(() => { running = false; });
    };
    refreshPush();
    const timer = window.setInterval(refreshPush, 60 * 60_000);
    window.addEventListener("focus", refreshPush);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshPush); };
  }, [user?.id, accountChanged]);

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
          // Query profile cũ có thể về sau click logout; không được khôi phục UI đã đăng xuất.
          if (active && !changedOwner.current && !["pending", "failed"].includes(useAuthStore.getState().logoutStatus)) setUser(profile);
        },
        (message) => {
          if (active && !changedOwner.current && !["pending", "failed"].includes(useAuthStore.getState().logoutStatus)) setError(message);
        },
        (owner) => {
          if (!active) return;
          const signedOutElsewhere = previousOwner.current !== null && owner === null && !isSigningOutHere();
          if (previousOwner.current && previousOwner.current !== owner && !isSigningOutHere() && owner !== null) {
            changedOwner.current = true;
            setAccountChanged(true);
            setUser(null);
          }
          previousOwner.current = owner;
          // Logout từ tab khác cũng về login ngay, không yêu cầu người dùng reload.
          if (!owner && !isSigningOutHere()) {
            setAccountChanged(false);
            changedOwner.current = false;
            setUser(null);
            if (signedOutElsewhere) router.replace("/auth/login");
          }
        },
      );
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [setUser, setError, router]);

  useEffect(() => {
    if (logoutStatus !== "idle" && !user && pathname !== "/auth/login") router.replace("/auth/login");
  }, [logoutStatus, user, pathname, router]);

  // 2. LOGIC ONBOARDING GUARD (Chỉ bắt buộc nhập SĐT khi cần)
  const needsOnboarding =
    status === "ready" &&
    user !== null &&
    !user.phone?.trim();

  // Các trang không bắt buộc phải nhảy sang Onboarding ngay lập tức
  const isBypassPage =
    pathname === "/auth/callback" ||
    pathname === "/account";
    // pathname === "/"; 

  const mustRedirect = !accountChanged && needsOnboarding && !isBypassPage;

  useEffect(() => {
    if (mustRedirect) {
      router.replace("/account");
    }
  }, [mustRedirect, router]);

  // Không signOut ở tab cũ: cookie đang thuộc account mới và signOut sẽ đá cả account mới.
  // Render login trong cùng React tree ngay ở click, không chờ route/network/FCM.
  if ((logoutStatus === "pending" || logoutStatus === "failed") ||
      (logoutStatus === "complete" && !user && pathname !== "/auth/login")) {
    // Provider thay toàn bộ route children: phải giữ cả shell, không chỉ render form.
    // .sf-auth cấp CSS variables căn giữa; thiếu shell làm form nhảy lên đầu màn hình.
    return <AuthShell><RegisterView mode="login" /></AuthShell>;
  }

  if (accountChanged) {
    return <section role="alert" className="p-6">
      <p>Phiên đăng nhập đã thay đổi. Tải lại trang để tiếp tục với tài khoản hiện tại.</p>
      <button type="button" onClick={() => window.location.reload()}>Tải lại trang</button>
    </section>;
  }

  if (mustRedirect) {
    return (
      <p role="status" className="p-6">
        Đang chuyển đến bước hoàn tất tài khoản...
      </p>
    );
  }

  return children;
}
