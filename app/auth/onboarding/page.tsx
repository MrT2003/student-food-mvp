import type { Metadata } from "next";
import AuthCompletionView from "@/components/features/auth/AuthCompletionView";

export const metadata: Metadata = {
  title: "Hoàn tất tài khoản | StudentFood",
};

export default function OnboardingPage() {
  return <AuthCompletionView mode="onboarding" />;
}