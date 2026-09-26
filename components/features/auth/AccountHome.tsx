"use client";

import Button from "@/components/ui/Button";
import { useSignOut } from "@/lib/auth/useAuthFlow";
import { useAuthStore } from "@/store/useAuthStore";

const roleLabels = {
  student: "Sinh viên",
  seller: "Người bán",
  staff: "Nhân viên",
};

export default function AccountHome() {
  const user = useAuthStore((state) => state.user);
  const { logout, pending, error } = useSignOut();

  if (!user) return null;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold">
        Xin chào, {user.name}
      </h1>

      <p className="mt-4">
        Vai trò: {roleLabels[user.role]}
      </p>

      <p className="mt-2">
        Số điện thoại: {user.phone}
      </p>

      <p className="mt-6">
        Tài khoản đã sẵn sàng. Các tính năng StudentFood đang
        được hoàn thiện.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-red-600">
          {error}
        </p>
      )}

      <Button
        className="mt-6"
        disabled={pending}
        onClick={() => void logout()}
      >
        {pending ? "Đang đăng xuất..." : "Đăng xuất"}
      </Button>
    </main>
  );
}