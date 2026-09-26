import AuthGuard from "@/components/features/auth/AuthGuard";
import AccountHome from "@/components/features/auth/AccountHome";

export default function HomePage() {
  return (
    <AuthGuard>
      <AccountHome />
    </AuthGuard>
  );
}