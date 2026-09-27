"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import AuthIntro from "@/components/features/auth/AuthIntro";
import AuthBenefits from "@/components/features/auth/AuthBenefits";
import SocialAuthButtons from "@/components/features/auth/SocialAuthButtons";
import { useSignIn } from "@/lib/auth/useAuthFlow";

type Props = {
  mode?: "register" | "login";
};

export default function RegisterView({ mode = "register" }: Props) {
  const { pending, error, continueWithGoogle } = useSignIn();
  const isRegister = mode === "register";

  return (
    <div className="mx-auto w-full max-w-[1380px]">
      <div
        className={[
          "mx-auto grid max-w-[1200px] overflow-hidden",
          "rounded-3xl border border-orange-100/70 bg-white",
          "shadow-[0_8px_35px_rgba(90,50,20,0.08)]",
          "lg:grid-cols-2",
          !isRegister ? "lg:min-h-[650px]" : "",
        ].join(" ")}
      >
        <div className="order-2 lg:order-1">
          <AuthIntro mode={mode} />
        </div>

        <section className="order-1 flex flex-col justify-center px-6 py-10 sm:px-10 lg:order-2 lg:px-12 lg:py-14">
          <div className="text-center">
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
                Đăng nhập để tiếp tục khám phá những món ngon
                sinh viên.
              </p>
            )}
          </div>

          <div
            className={[
              "mx-auto w-full",
              isRegister
                ? "mt-9 max-w-[430px]"
                : "mt-12 max-w-[460px]",
            ].join(" ")}
          >
            <SocialAuthButtons
              mode={mode}
              pending={pending}
              error={error}
              onGoogle={() => void continueWithGoogle()}
            />
          </div>

          <p
            className={[
              "text-center text-[#526a9e]",
              isRegister ? "mt-7" : "mt-10",
            ].join(" ")}
          >
            {isRegister
              ? "Đã có tài khoản? "
              : "Chưa có tài khoản? "}

            <Link
              href={
                isRegister ? "/auth/login" : "/auth/register"
              }
              className="font-medium text-[#e94a12] underline underline-offset-4 hover:text-[#c93a09]"
            >
              {isRegister ? "Đăng nhập" : "Đăng ký"}
            </Link>
          </p>

          {isRegister && (
            <div className="mt-9 flex items-start gap-3 rounded-2xl border border-[#ffe1d0] bg-[#fff7f1] p-4">
              <Info
                size={27}
                className="mt-0.5 shrink-0 text-[#ff531b]"
                aria-hidden="true"
              />

              <p className="text-sm leading-relaxed text-[#526a9e]">
                Tài khoản mới dùng để đặt món. Khi muốn bán hàng,
                bạn có thể chuyển sang tài khoản người bán tại
                mục{" "}
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