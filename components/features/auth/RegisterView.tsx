"use client";

import AuthBenefits from "@/components/features/auth/AuthBenefits";
import AuthIntro from "@/components/features/auth/AuthIntro";
import SocialAuthButtons from "@/components/features/auth/SocialAuthButtons";
import { useSignIn } from "@/lib/auth/useAuthFlow";
import styles from "@/styles/auth-fit.module.css";

export default function RegisterView() {
  const { pendingProvider, error, continueWithGoogle, continueWithZalo } =
    useSignIn();

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
          <AuthIntro />
        </div>

        <section
          className={`${styles.formPanel} order-1 flex flex-col justify-center px-6 py-10 sm:px-10 lg:order-2 lg:px-12 lg:py-14`}
        >
          <div className={`${styles.formHeading} text-center`}>
            <h1 className="text-3xl leading-[1.2] font-bold tracking-tight text-[#0d224c] sm:text-4xl">
              Chào bạn đến với
              <br />
              Student<span className="text-[#ff4d0a]">Food</span>
            </h1>

            <p className="mt-4 leading-relaxed text-[#526a9e]">
              Đăng nhập hoặc tạo tài khoản để tiếp tục.
            </p>
          </div>

          <div
            className={[
              styles.providers,
              "mx-auto mt-8 w-full max-w-[440px]",
            ].join(" ")}
          >
            <SocialAuthButtons
              pendingProvider={pendingProvider}
              error={error}
              onGoogle={() => void continueWithGoogle()}
              onZalo={() => void continueWithZalo()}
            />
          </div>

          <p className={`${styles.switchAccount} mt-6 text-center text-sm text-[#526a9e]`}>
            Tài khoản mới sẽ được tạo khi bạn xác thực lần đầu.
          </p>

          <p className={`${styles.registerNotice} mt-9 text-center text-sm leading-relaxed text-[#526a9e]`}>
            Bằng việc tiếp tục, bạn đồng ý với
            <br />
            <span className="font-medium text-[#e94a12] underline underline-offset-4">
              Điều khoản sử dụng
            </span>{" "}
            và{" "}
            <span className="font-medium text-[#e94a12] underline underline-offset-4">
              Chính sách quyền riêng tư
            </span>
            .
          </p>
        </section>
      </div>

      <AuthBenefits />
    </div>
  );
}
