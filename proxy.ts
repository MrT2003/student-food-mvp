// middleware.ts
import { updateSession } from '@/lib/supabase/proxy'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Worker có thể được browser cập nhật khi không còn session: phải trả JS, không redirect login.
  // Service Worker luôn được brows cập nhật và kiểm tra ngầm ngay cả khi người dùng đã đăng xuất
  // hoặc hết hạn phiên đăng nhập. Nếu không bypass, middleware sẽ đẩy người dùng về /login
  // Khi đó trình duyệt đang tải file JS của Service Worker sẽ nhận lại một trang HTML đăng nhập ---> Làm
  // hỏng hoàn toàn Service Worker ---> TÍNH NĂNG THÔNG BÁO NGẦM BỊ CHẾT
  // Chỉ bypass đúng hai tài nguyên công khai, không bỏ kiểm tra Auth cho các route khác.
  if (request.nextUrl.pathname === '/firebase-messaging-sw.js'
    || request.nextUrl.pathname === '/manifest.webmanifest'
    || request.nextUrl.pathname === '/api/firebase/worker-config') {
    return NextResponse.next();
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Ignore static files , images and favicon to avoid running unnecessary middleware
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
