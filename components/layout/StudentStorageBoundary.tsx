"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { startStudentPersistence, useStudentMockStore } from "@/store/useStudentMockStore";

export default function StudentStorageBoundary({ children }: { children: ReactNode }) {
  const ready = useStudentMockStore((state) => state.hasHydrated);
  const warning = useStudentMockStore((state) => state.storageWarning);
  const syncFromDatabase = useStudentMockStore((state) => state.syncFromDatabase);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [syncedUser, setSyncedUser] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    // Accessing localStorage itself can throw when browser storage is disabled.
    return startStudentPersistence({
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Chưa có dữ liệu trong store không đồng nghĩa đơn không tồn tại.
    let cancelled = false;
    void syncFromDatabase(userId).finally(() => {
      if (!cancelled) setSyncedUser(userId);
    });
    return () => { cancelled = true; };
  }, [ready, userId, syncFromDatabase]);

  if (!ready) return <p role="status" style={{ padding: 24 }}>Đang khôi phục giỏ hàng và đơn hàng…</p>;
  if (syncedUser !== userId) return <p role="status" style={{ padding: 24 }}>Đang tải giỏ hàng và đơn hàng…</p>;

  return <>
    {warning && <p role="alert" style={{ padding: 12, margin: 0, background: "#fff3df", color: "#713f12" }}>{warning}</p>}
    {children}
  </>;
}
