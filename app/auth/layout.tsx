import type { ReactNode } from "react";
import AuthHeader from "@/components/layout/AuthHeader";

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="sf-auth relative isolate flex min-h-screen flex-col overflow-x-clip">
      <AuthHeader />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-24 -left-28 -z-10 size-64 rounded-full bg-[#ffe7cf]/45"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-56 -right-44 -z-10 size-[390px] rounded-full bg-[#ffe7cf]/40"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 -left-40 -z-10 size-[460px] rounded-full bg-[#ffe7cf]/35"
      />

      <main className="flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}