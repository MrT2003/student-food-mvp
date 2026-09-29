import GoogleLoginButton from '@/components/buttons/GoogleLoginButton'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-6 bg-white rounded-xl shadow-md space-y-4 text-center">
        <h1 className="text-xl font-bold">Thử nghiệm Đăng nhập</h1>
        <GoogleLoginButton />
      </div>
    </main>
  )
}