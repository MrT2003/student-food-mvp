"use client";

import { useEffect, useState } from "react";
import { CircleCheck, LogIn, Mail, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getAuthErrorMessage, signInWithGoogle } from "@/services/auth.service";
import { useAuthStore } from "@/store/useAuthStore";
import styles from "@/styles/account.module.css";

type IdentityState = {
  userId: string | null;
  googleLinked: boolean;
  error: string | null;
};

export default function AccountSecurity() {
  const user = useAuthStore((state) => state.user);

  const [identity, setIdentity] = useState<IdentityState | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      try {
        const { data, error } = await getSupabaseClient().auth.getUser();

        if (error) throw error;

        const googleLinked =
          data.user?.identities?.some((item) => item.provider === "google") ??
          false;

        if (!cancelled) {
          setIdentity({
            userId: data.user?.id ?? null,
            googleLinked,
            error: null,
          });
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setIdentity({
            userId: null,
            googleLinked: false,
            error: getAuthErrorMessage(error),
          });
        }
      }
    }

    void loadIdentity();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleGoogleLogin() {
    if (pending) return;

    // Đăng nhập một tài khoản khác không đồng nghĩa
    // với liên kết tài khoản đó vào hồ sơ hiện tại.
    if (
      identity?.userId &&
      !window.confirm(
        "Đăng nhập Google có thể chuyển sang tài khoản khác. " +
          "Thao tác này không liên kết Google vào tài khoản hiện tại. " +
          "Bạn có muốn tiếp tục?",
      )
    ) {
      return;
    }

    setPending(true);
    setActionError("");

    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      setActionError(getAuthErrorMessage(error));
      setPending(false);
    }
  }

  const loading = identity === null;
  const googleLinked = identity?.googleLinked ?? false;
  const error = actionError || identity?.error;

  return (
    <section className={styles.card} aria-labelledby="security-title">
      <div className={styles.sectionHeading}>
        <span className={styles.sectionIcon}>
          <ShieldCheck size={27} aria-hidden="true" />
        </span>

        <div>
          <h2 id="security-title">Bảo mật tài khoản</h2>
          <p>Quản lý các phương thức đăng nhập của bạn.</p>
        </div>
      </div>

      <div className={styles.providerList}>
        <div className={styles.providerRow}>
          <span
            className={`${styles.providerLogo} ${styles.zaloLogo}`}
            aria-hidden="true"
          >
            Zalo
          </span>

          <div className={styles.providerCopy}>
            <h3>Zalo</h3>
            <p>Phương thức đăng nhập Zalo đang được tích hợp.</p>
          </div>

          <span className={styles.providerPending}>Đang tích hợp</span>
        </div>

        <div className={styles.providerRow}>
          <span
            className={`${styles.providerLogo} ${styles.googleLogo}`}
            aria-hidden="true"
          >
            <Mail size={28} />
          </span>

          <div className={styles.providerCopy}>
            <h3>Google / Gmail</h3>
            <p>
              {loading
                ? "Đang kiểm tra phương thức đăng nhập..."
                : identity?.error
                  ? "Chưa xác minh được trạng thái liên kết."
                  : googleLinked
                    ? "Tài khoản của bạn đã liên kết với Google."
                    : "Sử dụng tài khoản Google để đăng nhập."}
            </p>
          </div>

          {loading ? (
            <span className={styles.providerPending} role="status">
              Đang kiểm tra…
            </span>
          ) : googleLinked ? (
            <span className={styles.providerConnected}>
              <CircleCheck size={18} aria-hidden="true" />
              Đã liên kết
            </span>
          ) : (
            <button
              type="button"
              className={styles.providerButton}
              disabled={pending || Boolean(identity?.error)}
              aria-busy={pending}
              onClick={handleGoogleLogin}
            >
              <LogIn size={19} aria-hidden="true" />
              {pending ? "Đang chuyển hướng…" : "Đăng nhập bằng Google"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
