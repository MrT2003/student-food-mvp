import { create } from "zustand";
import type { AuthProfile } from "@/types/auth.types";

type AuthState = {
  user: AuthProfile | null;
  status: "loading" | "ready" | "error";
  error: string | null;
  // Tách trạng thái logout khỏi profile: trang login vẫn biết tiến trình sau khi component cũ unmount.
  logoutStatus: "idle" | "pending" | "failed" | "complete";
  logoutOwner: string | null;
  logoutError: string | null;

  setUser: (user: AuthProfile | null) => void;
  setError: (message: string) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  error: null,
  logoutStatus: "idle",
  logoutOwner: null,
  logoutError: null,

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
