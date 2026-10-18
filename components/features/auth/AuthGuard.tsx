"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import type { AuthProfile } from "@/types/auth.types";

type Props = {
  children: ReactNode;
  allowedRoles?: AuthProfile["role"][];
};

export default function AuthGuard({
  children,
  allowedRoles,
}: Props) {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);

  const destination =
    status !== "ready"
      ? null
      : !user
        ? "/auth/login"
        : !user.phone?.trim()
          ? "/auth/onboarding"
          : null;

  useEffect(() => {
    if (destination) {
      router.replace(destination);
    }
  }, [destination, router]);

  if (status === "error") {
    return (
      <section className="mx-auto max-w-lg p-6">
        <p role="alert">
          {error ?? "Chưa thể xác minh tài khoản."}
        </p>

        <div className="mt-4 flex gap-5">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="underline"
          >
            Thử lại
          </button>

          <Link href="/auth/login" className="underline">
            Đăng nhập
          </Link>
        </div>
      </section>
    );
  }

  if (status === "loading" || destination || !user) {
    return (
      <p role="status" className="p-6">
        Đang kiểm tra tài khoản...
      </p>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <section className="p-6">
        <h1 className="text-xl font-bold">Không có quyền truy cập</h1>
        <p className="mt-2">
          Tài khoản của bạn không được phép sử dụng chức năng này.
        </p>
        <Link href="/" className="mt-4 inline-block underline">
          Về trang chủ
        </Link>
      </section>
    );
  }

  return children;
}