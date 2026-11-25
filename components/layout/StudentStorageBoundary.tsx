"use client";

import { useEffect, type ReactNode } from "react";
import ShipperLoader from "@/components/ui/ShipperLoader";
import { purchaseSyncUserId } from "@/lib/auth/purchase-access";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";
import { startStudentPersistence, useStudentMockStore } from "@/store/useStudentMockStore";

const STUDENT_ORDER_POLL_MS = 5_000;

export default function StudentStorageBoundary({ children }: { children: ReactNode }) {
  const ready = useStudentMockStore((state) => state.hasHydrated);
  const warning = useStudentMockStore((state) => state.storageWarning);
  const syncFromDatabase = useStudentMockStore((state) => state.syncFromDatabase);
  const userId = useAuthStore(purchaseSyncUserId);
  const role = useAuthStore((state) => state.user?.role);

  useEffect(() => {
    // Accessing localStorage itself can throw when browser storage is disabled.
    return startStudentPersistence({
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    });
  }, []);

  useEffect(() => {
    if (!ready || !userId) return;
    let active = true;
    const sync = () => {
      const auth = useAuthStore.getState();
      if (active && purchaseSyncUserId(auth) === userId && auth.user?.role === role)
        void syncFromDatabase(userId);
    };
    sync();

    const supabase = createClient();
    const channel = supabase
      .channel(`student-orders:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `student_id=eq.${userId}`,
        },
        sync,
      )
      .subscribe();

    const refreshIfVisible = () => {
      if (document.visibilityState !== "hidden" && navigator.onLine !== false) {
        sync();
      }
    };

    const intervalId = window.setInterval(refreshIfVisible, STUDENT_ORDER_POLL_MS);
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      void supabase.removeChannel(channel);
    };
  }, [ready, userId, role, syncFromDatabase]);

  if (!ready) {
    return (
      <ShipperLoader
        label="Đang khôi phục giỏ hàng và đơn hàng…"
        fullPage
      />
    );
  }

  return <>
    {warning && <p role="alert" style={{ padding: 12, margin: 0, background: "#fff3df", color: "#713f12" }}>{warning}</p>}
    {children}
  </>;
}
