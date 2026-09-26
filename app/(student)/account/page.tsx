import type { Metadata } from "next";
import AccountView from "@/components/features/account/AccountView";

export const metadata: Metadata = {
  title: "Tài khoản của tôi | StudentFood",
  description: "Quản lý thông tin cá nhân và bảo mật tài khoản.",
};

export default function AccountPage() {
  return <AccountView />;
}