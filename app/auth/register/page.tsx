import type { Metadata } from "next";
import RegisterView from "@/components/features/auth/RegisterView";

export const metadata: Metadata = {
  title: "Đăng ký | StudentFood",
  description:
    "Bắt đầu cùng StudentFood. Đặt món ngon quanh ký túc xá.",
};

export default function RegisterPage() {
  return <RegisterView mode="register" />;
}