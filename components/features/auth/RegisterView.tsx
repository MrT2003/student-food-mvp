"use client";

import AuthBenefits from "@/components/features/auth/AuthBenefits";
import AuthIntro from "@/components/features/auth/AuthIntro";
import SocialAuthButtons from "@/components/features/auth/SocialAuthButtons";
import { useSignIn, useSignOut } from "@/lib/auth/useAuthFlow";
import { useAuthStore } from "@/store/useAuthStore";
import styles from "@/styles/auth-fit.module.css";
import { Info } from "lucide-react";
import Link from "next/link";

type Props = {
  mode?: "register" | "login";
};

export default function RegisterView({ mode = "register" }: Props) {
  const { pending, error, continueWithGoogle, continueWithZalo } = useSignIn();
  const logoutStatus = useAuthStore((state) => state.logoutStatus);
  const { logout, signOutError } = useSignOut();
  const finishingLogout = logoutStatus === "pending" || logoutStatus === "failed";
  const isRegister = mode === "register";

  return (
    <div className={`${styles.page} mx-auto w-full max-w-[1380px]`}>
      <div
        className={[
          styles.authCard,
          "mx-auto grid max-w-[1200px] overflow-hidden",
          "rounded-3xl border border-orange-100/70 bg-white",
          "shadow-[0_8px_35px_rgba(90,50,20,0.08)]",
          "lg:grid-cols-2",
        ].join(" ")}
      >
        <div className={`${styles.introWrapper} order-2 lg:order-1`}>
          <AuthIntro mode={mode} />
        </div>

        <section
          className={`${styles.formPanel} order-1 flex flex-col justify-center px-6 py-10 sm:px-10 lg:order-2 lg:px-12 lg:py-14`}
        >
          <div className={`${styles.formHeading} text-center`}>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {isRegister ? "Đăng ký" : "Đăng nhập"}
            </h1>

            {isRegister ? (
              <p className="mt-4 leading-relaxed text-[#526a9e]">
                Chọn phương thức để bắt đầu cùng StudentFood.
              </p>
            ) : (
              <p className="mt-5 leading-relaxed text-[#526a9e]">
                Chào mừng bạn trở lại với StudentFood!
                <br />
                Đăng nhập để tiếp tục khám phá những món ngon sinh viên.
              </p>
            )}
          </div>

          <div
            className={[
              styles.providers,
              "mx-auto w-full",
              isRegister ? "mt-9 max-w-[430px]" : "mt-12 max-w-[460px]",
            ].join(" ")}
          >

            {/* Trang đã mở ngay; khóa login mới đến khi session cũ đã kết thúc an toàn. */}
            {logoutStatus === "pending" && <p role="status">Đang hoàn tất đăng xuất…</p>}
            {logoutStatus === "failed" && <div role="alert">
              <p>{signOutError}</p>
              <button type="button" onClick={() => void logout()}>Thử lại đăng xuất</button>
            </div>}
            <SocialAuthButtons
              mode={mode}
              pending={pending || finishingLogout}
              error={error}
              onGoogle={() => void continueWithGoogle()}
              onZalo={() => void continueWithZalo()}
            />
          </div>

          <p
            className={[
              styles.switchAccount,
              "text-center text-[#526a9e]",
              isRegister ? "mt-7" : "mt-10",
            ].join(" ")}
          >
            {isRegister ? "Đã có tài khoản? " : "Chưa có tài khoản? "}

            <Link
              href={isRegister ? "/auth/login" : "/auth/register"}
              className="font-medium text-[#e94a12] underline underline-offset-4 hover:text-[#c93a09]"
            >
              {isRegister ? "Đăng nhập" : "Đăng ký"}
            </Link>
          </p>

          {isRegister && (
            <div
              className={`${styles.registerNotice} mt-9 flex items-start gap-3 rounded-2xl border border-[#ffe1d0] bg-[#fff7f1] p-4`}
            >
              <Info
                size={27}
                className="mt-0.5 shrink-0 text-[#ff531b]"
                aria-hidden="true"
              />

              <p className="text-sm leading-relaxed text-[#526a9e]">
                Tài khoản mới dùng để đặt món. Khi muốn bán hàng, bạn có thể
                chuyển sang tài khoản người bán tại mục{" "}
                <span className="font-medium text-[#e94a12]">
                  “Tạo cửa hàng”
                </span>
                .
              </p>
            </div>
          )}
        </section>
      </div>

      <AuthBenefits mode={mode} />
    </div>
  );
}
