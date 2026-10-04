import Link from "next/link";
import { Utensils } from "lucide-react";

export default function AuthHeader() {
  return (
    <header className="relative z-10 border-b border-orange-100/70 bg-white">
      <div className="mx-auto flex min-h-20 max-w-[1380px] items-center justify-between gap-5 px-5 sm:px-8">
        <Link
          href="/auth/register"
          aria-label="StudentFood - Trang đăng ký"
          className="flex items-center gap-3"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6d23] to-[#ff3c00] text-white shadow-sm">
            <Utensils size={28} aria-hidden="true" />
          </span>

          <span>
            <span className="block text-2xl leading-tight font-bold tracking-tight">
              Student<span className="text-[#ff4d0a]">Food</span>
            </span>
            <span className="block text-sm text-[#526a9e]">
              Món ngon, gần bạn hơn
            </span>
          </span>
        </Link>

        <nav
          aria-label="Thông tin StudentFood"
          className="hidden items-center gap-10 md:flex"
        >
          {["Về StudentFood", "Hỗ trợ", "Liên hệ"].map((label) => (
            <button
              key={label}
              type="button"
              disabled
              title="Nội dung đang được cập nhật"
              className="text-sm font-medium lg:text-base"
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}