import type { Metadata } from "next";
import RegisterView from "@/components/features/auth/RegisterView";

export const metadata: Metadata = {
  title: "Đăng nhập | StudentFood",
  description:
    "Đăng nhập hoặc tạo tài khoản StudentFood để khám phá món ngon quanh trường.",
};

export default function LoginPage() {
  return <RegisterView />;
}
