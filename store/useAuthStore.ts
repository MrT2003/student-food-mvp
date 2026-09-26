import { create } from "zustand";
import type { AuthProfile } from "@/types/auth.types";

type AuthState = {
  user: AuthProfile | null;
  status: "loading" | "ready" | "error";
  error: string | null;

  setUser: (user: AuthProfile | null) => void;
  setError: (message: string) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  error: null,

  setUser: (user) =>
    set({
      user,
      status: "ready",
      error: null,
    }),

  setError: (message) =>
    set({
      user: null,
      status: "error",
      error: message,
    }),
}));