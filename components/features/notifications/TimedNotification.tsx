"use client";
import { useEffect, useRef, type ReactNode } from "react";

// Đếm thời gian hiển thị thực tế; hover/focus/tab ẩn không làm hết giờ khi đang đọc.
export default function TimedNotification({ children, onExpire }: { children: ReactNode; onExpire: () => void }) {
  const expire = useRef(onExpire);
  expire.current = onExpire;
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let remaining = 8000;
    let started = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hovered = false;
    const stop = () => { if (timer) { clearTimeout(timer); timer = undefined; remaining -= Date.now() - started; } };
    const sync = () => {
      stop();
      if (document.visibilityState !== "visible" || hovered || root.current?.contains(document.activeElement)) return;
      started = Date.now(); timer = setTimeout(() => expire.current(), Math.max(0, remaining));
    };
    const enter = () => { hovered = true; sync(); };
    const leave = () => { hovered = false; sync(); };
    const blur = () => { queueMicrotask(sync); };
    const element = root.current!;
    element.addEventListener("mouseenter", enter); element.addEventListener("mouseleave", leave);
    element.addEventListener("focusin", sync); element.addEventListener("focusout", blur);
    document.addEventListener("visibilitychange", sync); sync();
    return () => { stop(); element.removeEventListener("mouseenter", enter); element.removeEventListener("mouseleave", leave); element.removeEventListener("focusin", sync); element.removeEventListener("focusout", blur); document.removeEventListener("visibilitychange", sync); };
  }, []);
  return <div ref={root} className="pointer-events-auto">{children}</div>;
}
