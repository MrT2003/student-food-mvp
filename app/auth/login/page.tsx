import type { Metadata } from "next";
import RegisterView from "@/components/features/auth/RegisterView";

export const metadata: Metadata = {
  title: "Đăng nhập | StudentFood",
};

export default function LoginPage() {
  return <RegisterView mode="login" />;
}