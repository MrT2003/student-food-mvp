import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold">Chưa thể hoàn tất đăng nhập</h1>
      <p className="mt-4">Phiên xác thực có thể đã hết hạn hoặc hồ sơ chưa được khởi tạo. Vui lòng thử đăng nhập lại.</p>
      <Link className="mt-6 inline-block underline" href="/auth/login">Quay lại đăng nhập</Link>
    </main>
  );
}
