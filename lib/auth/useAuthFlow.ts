"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { AuthClientService } from "@/services/auth.service";

// useSignIn handle sign in process with Google and Zalo
export function useSignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueWithGoogle() {
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      await AuthClientService.signInWithGoogle();
    } catch (error) {
      setError(AuthClientService.getAuthErrorMessage(error));
      setPending(false);
    }
  }

  async function continueWithZalo() {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      AuthClientService.singInWithZalo();
    }catch(error){
      setError(AuthClientService.getAuthErrorMessage(error));
      setPending(false);
    } 
  }

  return { pending, error, continueWithGoogle, continueWithZalo };
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
      await AuthClientService.signOut()
      setUser(null);
      router.replace("/auth/login");
      // Clear the router cache of browser 
      router.refresh() 
    } catch (error) {
      setSignOutError(AuthClientService.getAuthErrorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return { logout, pending, signOutError };
}

export function useAuthCompletion(
  mode: "callback" | "onboarding",
) {
  const router = useRouter();

  const profile = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const setUser = useAuthStore((state) => state.setUser);

  const [nameDraft, setName] = useState<string | null>(null);
  const [phoneDraft, setPhone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const name = nameDraft ?? profile?.name ?? "";
  const phone = phoneDraft ?? profile?.phone ?? "";


  let destination: string | null = null;

  if (status === "ready") {
    if (!profile) {
      destination = "/auth/login";
    }
     else if (profile.phone?.trim()) {
      destination = "/";
    } else if (mode === "callback") {
      destination = "/auth/onboarding";
    }
  }

  useEffect(() => {
    if (destination) {
      router.replace(destination);
    }
  }, [destination, router]);

  async function saveProfile() {
    if (!profile || saving) return;

    setSaving(true);
    setLocalError(null);

    try {
      const updated = await AuthClientService.updateMyProfile({
        name,
        phone,
        avatarUrl: profile.avatar_url,
      });

      setUser(updated);
      router.replace("/");
    } catch (error) {
      setLocalError(AuthClientService.getAuthErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function changeAccount() {
    if (saving) return;

    setSaving(true);
    setLocalError(null);

    try {
      await AuthClientService.signOut();
      setUser(null);
      router.replace("/auth/login");
    } catch (error) {
      setLocalError(AuthClientService.getAuthErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }
  return {
    profile,
    name,
    phone,
    loading: status === "loading" || destination !== null,
    saving,
    error: localError ?? authError,
    setName,
    setPhone,
    saveProfile,
    changeAccount,
  };
}