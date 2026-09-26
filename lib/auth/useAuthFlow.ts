"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAuthErrorMessage,
  signInWithGoogle,
  signOut,
  updateMyProfile,
} from "@/services/auth.service";
import { useAuthStore } from "@/store/useAuthStore";

export function useSignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueWithGoogle() {
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      await signInWithGoogle();
    } catch (error) {
      setError(getAuthErrorMessage(error));
      setPending(false);
    }
  }

  return { pending, error, continueWithGoogle };
}

export function useSignOut() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      await signOut();
      setUser(null);
      router.replace("/auth/login");
    } catch (error) {
      setError(getAuthErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return { logout, pending, error };
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
    } else if (profile.phone?.trim()) {
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
      const updated = await updateMyProfile({
        name,
        phone,
        avatarUrl: profile.avatar_url,
      });

      setUser(updated);
      router.replace("/");
    } catch (error) {
      setLocalError(getAuthErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function changeAccount() {
    if (saving) return;

    setSaving(true);
    setLocalError(null);

    try {
      await signOut();
      setUser(null);
      router.replace("/auth/login");
    } catch (error) {
      setLocalError(getAuthErrorMessage(error));
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