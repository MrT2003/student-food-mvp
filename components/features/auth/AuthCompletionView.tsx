"use client";

import Link from "next/link";
import { LoaderCircle, Phone } from "lucide-react";
import Button from "@/components/ui/Button";
import { useAuthCompletion } from "@/lib/auth/useAuthFlow";

type Props = {
  mode: "callback" | "onboarding";
};

export default function AuthCompletionView({ mode }: Props) {
  const {
    profile,
    name,
    phone,
    loading,
    saving,
    error,
    setName,
    setPhone,
    saveProfile,
    changeAccount,
  } = useAuthCompletion(mode);

  return (
    <section className="mx-auto my-8 max-w-lg rounded-3xl border border-orange-100 bg-white p-7 shadow-sm sm:p-10">
      {loading ? (
        <div role="status" className="py-10 text-center">
          <LoaderCircle
            className="mx-auto mb-4 size-9 animate-spin text-[#ff531b]"
            aria-hidden="true"
          />
          <p>Đang hoàn tất đăng nhập...</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <Phone
              className="mb-4 size-9 text-[#ff531b]"
              aria-hidden="true"
            />

            <h1 className="text-2xl font-bold">
              {profile ? "Hoàn tất tài khoản" : "Chưa thể đăng nhập"}
            </h1>

            {profile && (
              <p className="mt-3 leading-relaxed text-[#526a9e]">
                Bổ sung tên và số điện thoại để quán có thể liên hệ
                khi giao hàng.
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="mb-5 rounded-xl bg-red-50 p-4 text-sm leading-relaxed text-red-700"
            >
              {error}
            </p>
          )}

          {profile ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveProfile();
              }}
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="profile-name"
                  className="mb-2 block text-sm font-semibold"
                >
                  Họ và tên
                </label>

                <input
                  id="profile-name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={120}
                  disabled={saving}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-[#dce2ed] bg-white px-4 outline-none focus:border-[#ff531b] focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-phone"
                  className="mb-2 block text-sm font-semibold"
                >
                  Số điện thoại
                </label>

                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Nhập số điện thoại của bạn"
                  required
                  maxLength={25}
                  disabled={saving}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-[#dce2ed] bg-white px-4 outline-none focus:border-[#ff531b] focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
                />
              </div>

              <Button
                type="submit"
                disabled={saving}
                aria-busy={saving}
                className="w-full"
              >
                {saving && (
                  <LoaderCircle
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {saving ? "Đang xử lý..." : "Lưu và tiếp tục"}
              </Button>

              <button
                type="button"
                disabled={saving}
                onClick={() => void changeAccount()}
                className="w-full text-sm text-[#526a9e] underline underline-offset-4 disabled:opacity-60"
              >
                Sử dụng tài khoản khác
              </button>
            </form>
          ) : (
            <Link
              href="/auth/login"
              className="font-semibold text-[#e94a12] underline underline-offset-4"
            >
              Quay lại đăng nhập
            </Link>
          )}
        </>
      )}
    </section>
  );
}