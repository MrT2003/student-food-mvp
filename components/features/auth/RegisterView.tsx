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
      <div className="mx-auto grid max-w-[1200px] overflow-hidden rounded-3xl border border-orange-100/70 bg-white shadow-[0_8px_35px_rgba(90,50,20,0.08)] lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <AuthIntro />
        </div>

        <section className="order-1 flex flex-col justify-center px-6 py-10 sm:px-10 lg:order-2 lg:px-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight">
              {isRegister ? "Đăng ký" : "Đăng nhập"}
            </h1>

            <p className="mt-3 leading-relaxed text-[#526a9e]">
              {isRegister
                ? "Chọn phương thức để bắt đầu cùng StudentFood."
                : "Chào mừng bạn quay lại với StudentFood."}
            </p>
          </div>

          <div className="mx-auto mt-9 w-full max-w-[430px]">
            <SocialAuthButtons
              pending={pending}
              error={error}
              onGoogle={() => void continueWithGoogle()}
            />
          </div>

          <p className="mt-7 text-center text-[#526a9e]">
            {isRegister ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
            <Link
              href={isRegister ? "/auth/login" : "/auth/register"}
              className="font-medium text-[#e94a12] underline-offset-4 hover:underline"
            >
              {isRegister ? "Đăng nhập" : "Đăng ký"}
            </Link>
          </p>

          <div className="mt-9 flex items-start gap-3 rounded-2xl border border-[#ffe1d0] bg-[#fff7f1] p-4">
            <Info
              size={27}
              className="mt-0.5 shrink-0 text-[#ff531b]"
              aria-hidden="true"
            />

            <p className="text-sm leading-relaxed text-[#526a9e]">
              Tài khoản mới dùng để đặt món. Khi muốn bán hàng, bạn
              có thể chuyển sang tài khoản người bán tại mục{" "}
              <span className="font-medium text-[#e94a12]">
                “Tạo cửa hàng”
              </span>
              .
            </p>
          </div>
        </section>
      </div>

      <AuthBenefits />
    </div>
  );
}