"use client";

import { useState } from "react";
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
    if (pending) return;

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
  const setUser = useAuthStore((state) => state.setUser);
  const [pending, setPending] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function logout() {
    if (pending) return;

    setPending(true);
    setSignOutError(null);

    try {
      // Interact with DB
      await AuthClientService.signOut();
      setUser(null);
      router.replace("/auth/login");
      // Clear the router cache of browser
      router.refresh();
    } catch (error) {
      setSignOutError(AuthClientService.getAuthErrorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return { logout, pending, signOutError };
}
