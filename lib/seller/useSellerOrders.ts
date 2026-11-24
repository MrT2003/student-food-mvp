"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { decideSellerOrder, isOrderAccessDenied, readSellerOrders } from "./orders-client";
import { initialOrderReadState, SellerOrdersRefresh } from "./orders-refresh";

export function useSellerOrders(actor: string, restaurantId: string) {
  const identity = `${actor}:${restaurantId}`;
  const [read, setRead] = useState({ identity, ...initialOrderReadState() });
  const [notice, setNotice] = useState(""), [actionError, setActionError] = useState("");
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const controller = useRef<SellerOrdersRefresh | null>(null), busy = useRef(new Set<string>());
  const current = useCallback(() => useAuthStore.getState().user?.id === actor, [actor]);
  useEffect(() => {
    let mounted = true;
    const refresh = new SellerOrdersRefresh({
      read: signal => readSellerOrders(actor, restaurantId, signal), denied: isOrderAccessDenied,
      changed: state => { if (mounted && current()) setRead({ identity, ...state }); },
    });
    controller.current = refresh;
    const available = () => document.visibilityState !== "hidden" && navigator.onLine !== false;
    const resume = () => {
      if (!current()) { refresh.dispose(); return; }
      refresh.setActive(available());
    };
    const focus = () => { resume(); if (available() && current()) void refresh.refresh(); };
    void Promise.resolve().then(() => { if (mounted) resume(); });
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume); window.addEventListener("offline", resume);
    window.addEventListener("focus", focus);
    return () => {
      mounted = false; refresh.dispose();
      if (controller.current === refresh) controller.current = null;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume); window.removeEventListener("offline", resume); window.removeEventListener("focus", focus);
    };
  }, [actor, restaurantId, identity, current]);

  const reload = () => controller.current?.refresh(true) ?? Promise.resolve(null);
  const state = read.identity === identity && current() ? read : initialOrderReadState();

  async function decide(orderId: string, action: "accept" | "reject" | "complete") {
    const refresh = controller.current;
    const expectedCurrentStatus = action === "complete" ? "accepted" : "pending";
    if (!refresh || state.loading || state.blocked || !current() || busy.current.has(orderId) || !state.orders?.some(row => row.id === orderId && row.order_status === expectedCurrentStatus)) return;
    const alive = () => controller.current === refresh && current();
    busy.current.add(orderId); setBusyIds([...busy.current]); setNotice(""); setActionError("");
    // A late GET started before this write must never restore a stale pending state.
    refresh.beginMutation();
    try {
      const result = await decideSellerOrder(actor, restaurantId, orderId, action);
      const label = action === "accept" ? "được chấp nhận" : action === "reject" ? "bị từ chối" : "đã hoàn thành";
      if (alive()) setNotice(`${result.recovered ? "Đã đọc lại và xác nhận" : "Backend đã xác nhận"}: đơn ${label}.`);
    } catch (reason) {
      if (alive()) setActionError(reason instanceof Error ? reason.message : "Chưa xác định kết quả. Hãy tải lại trạng thái.");
    } finally {
      // Read errors have a separate warning; an acknowledged write remains successful.
      await refresh.endMutation();
      busy.current.delete(orderId);
      if (alive()) setBusyIds([...busy.current]);
    }
  }
  return { ...state, notice, actionError, busyIds, reload, decide, clearNotice: () => { setNotice(""); setActionError(""); } };
}
