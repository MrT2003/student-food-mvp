"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Link2, Mail, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import styles from "@/styles/account.module.css";

type Methods = { userId: string; google: boolean; zalo: boolean };
const feedback: Record<string, string> = {
  success: "Đã liên kết Zalo. Bạn có thể đăng nhập cùng tài khoản bằng Google hoặc Zalo.",
  conflict: "Zalo này hoặc tài khoản StudentFood đã có liên kết khác. Không thể tự động gộp hai tài khoản.",
  cancelled: "Bạn đã hủy liên kết Zalo.",
  session_changed: "Phiên đăng nhập đã thay đổi hoặc hết hạn. Vui lòng đăng nhập Google và liên kết lại.",
  failed: "Chưa thể liên kết Zalo. Vui lòng thử lại.",
};

export default function AccountSecurity() {
  const userId = useAuthStore((state) => state.user?.id);
  const [methods, setMethods] = useState<Methods | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/auth/zalo/link", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Không thể tải phương thức đăng nhập.");
        if (data.userId !== userId || typeof data.google !== "boolean" || typeof data.zalo !== "boolean") {
          throw new Error("Phiên đăng nhập đã thay đổi. Vui lòng tải lại trang.");
        }
        setMethods(data);
        setError("");
        const result = new URL(window.location.href).searchParams.get("zalo_link");
        if (result && (result !== "success" || data.zalo)) setNotice(feedback[result] || "");
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : "Không thể tải phương thức đăng nhập.");
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [userId, attempt]);

  async function linkZalo() {
    if (pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/zalo/link", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể bắt đầu liên kết.");
      const url = new URL(data.url);
      if (url.origin !== "https://oauth.zaloapp.com") throw new Error("Địa chỉ xác thực không hợp lệ.");
      window.location.assign(url.href);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể bắt đầu liên kết.");
      setPending(false);
    }
  }

  const current = methods?.userId === userId ? methods : null;
  return (
    <section className={styles.card} aria-labelledby="security-title">
      <div className={styles.sectionHeading}>
        <span className={styles.sectionIcon}><ShieldCheck size={27} aria-hidden="true" /></span>
        <div>
          <h2 id="security-title">Bảo mật tài khoản</h2>
          <p>Liên kết thêm phương thức để có thể đăng nhập khi mất quyền truy cập một tài khoản.</p>
        </div>
      </div>
      <div className={styles.providerList}>
        {(["zalo", "google"] as const).map((provider) => {
          const linked = current?.[provider] ?? false;
          const label = provider === "zalo" ? "Zalo" : "Google / Gmail";
          return (
            <div className={styles.providerRow} key={provider}>
              <span className={styles.providerLogo + " " + (provider === "zalo" ? styles.zaloLogo : styles.googleLogo)} aria-hidden="true">
                {provider === "zalo" ? "Zalo" : <Mail size={28} />}
              </span>
              <div className={styles.providerCopy}>
                <h3>{label}</h3>
                <p>{!current ? error ? "Chưa xác minh được phương thức đăng nhập." : "Đang kiểm tra phương thức đăng nhập..."
                  : linked ? "Bạn có thể dùng " + label + " để đăng nhập tài khoản này."
                  : "Chưa liên kết với tài khoản này."}</p>
              </div>
              {linked ? (
                <span className={styles.providerConnected}><CircleCheck size={18} aria-hidden="true" />Đã liên kết</span>
              ) : provider === "zalo" && current?.google ? (
                <button type="button" className={styles.providerButton} disabled={pending} aria-busy={pending} onClick={() => void linkZalo()}>
                  <Link2 size={19} aria-hidden="true" />{pending ? "Đang chuyển đến Zalo..." : "Liên kết Zalo"}
                </button>
              ) : (
                <span className={styles.providerPending}>{current ? "Chưa liên kết" : error ? "Chưa xác minh" : "Đang kiểm tra..."}</span>
              )}
            </div>
          );
        })}
      </div>
      {notice && <p className={styles.feedback} role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error} <button type="button" onClick={() => setAttempt((value) => value + 1)}>Thử lại</button></p>}
    </section>
  );
}
