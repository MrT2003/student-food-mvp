"use client";

import { useEffect, type ReactNode } from "react";
import { startStudentPersistence, useStudentMockStore } from "@/store/useStudentMockStore";

export default function StudentStorageBoundary({ children }: { children: ReactNode }) {
  const ready = useStudentMockStore((state) => state.hasHydrated);
  const warning = useStudentMockStore((state) => state.storageWarning);

  useEffect(() => {
    // Accessing localStorage itself can throw when browser storage is disabled.
    return startStudentPersistence({
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    });
  }, []);

  if (!ready) return <p role="status" style={{ padding: 24 }}>Đang khôi phục giỏ hàng và đơn hàng…</p>;

  return <>
    {warning && <p role="alert" style={{ padding: 12, margin: 0, background: "#fff3df", color: "#713f12" }}>{warning}</p>}
    {children}
  </>;
}
