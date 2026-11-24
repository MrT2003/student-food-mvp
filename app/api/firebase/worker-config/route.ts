// Worker trong public/ không được Next thay process.env: endpoint này xuất JS cấu hình công khai.
// Chỉ allowlist 4 trường Web; tuyệt đối không trả toàn bộ process.env hoặc Admin credentials.
export function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
  };
  const headers = {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (Object.values(config).some((value) => !value || value.includes("PRIVATE KEY") || value.startsWith("{"))) {
    // Fail khi install worker thay vì đăng ký thành công với cấu hình thiếu/sai.
    return new Response("/* Firebase Web configuration is missing or invalid. */", { status: 503, headers });
  }
  return new Response(`self.FIREBASE_WEB_CONFIG = ${JSON.stringify(config)};`, { headers });
}
