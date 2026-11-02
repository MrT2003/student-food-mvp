"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { AuthClientService } from "@/services/auth.service";

export type AuthProviderType = "google" | "zalo";

// useSignIn handle sign in process with Google and Zalo
export function useSignIn() {
  const [pendingProvider, setPendingProvider] =
    useState<AuthProviderType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = pendingProvider !== null;

  async function continueWithGoogle() {
    if (pending || ["pending", "failed"].includes(useAuthStore.getState().logoutStatus)) return;

    setPendingProvider("google");
    setError(null);

    try {
      await AuthClientService.signInWithGoogle();
    } catch (error) {
      setError(AuthClientService.getAuthErrorMessage(error));
      setPendingProvider(null);
    }
  }

  async function continueWithZalo() {
    if (pending) return;
    setPendingProvider("zalo");
    setError(null);

    try {
      AuthClientService.singInWithZalo();
    } catch (error) {
      setError(AuthClientService.getAuthErrorMessage(error));
      setPendingProvider(null);
    }
  }

  return {
    pending,
    pendingProvider,
    error,
    continueWithGoogle,
    continueWithZalo,
  };
}

// useSignOut handle sign out process
export function useSignOut() {
  const router = useRouter();
  const pending = useAuthStore((state) => state.logoutStatus === "pending");
  const signOutError = useAuthStore((state) => state.logoutError);

  // Chuẩn bị route trước khi click; AuthProvider còn render login ngay trong lúc route đang tải.
  useEffect(() => { router.prefetch("/auth/login"); }, [router]);

  async function logout() {
    if (pending) return;

    const task = AuthClientService.signOut();
    router.replace("/auth/login");
    try {
      await task;
      // Chỉ refresh sau khi cookie thực sự đã xóa, tránh server render lại account cũ.
      router.refresh();
    } catch { /* Lỗi được giữ trong store và hiển thị ở trang login, không mất khi unmount. */ }
  }
  return { logout, pending, signOutError };
}
