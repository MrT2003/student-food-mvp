import { NextResponse } from 'next/server'

// The client you created from the Server-Side Auth instructions
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get('next') ?? '/'
  // Protect redirect link from hacker 
  // if next is a malicious link attached by hacker such as next = "htps://hacker-website.com"
  // then next check will be false and return to the landing page by reset next = "/"
  if (!next.startsWith('/')) {
    // if "next" is not a relative URL, use the default
    next = '/'
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.user) {
      const user = data.user

      // 1. Trích xuất Tên và Avatar từ Google Metadata
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || ''

      // 2. Insert/Update vào bảng profiles trong Database của bạn
      await supabase.from('users').upsert(
        {
          id: user.id, // Primary Key kết nối với auth.users
          auth_uid: user.id,
          email: user.email,
          role: "student",
          status:"active",
          name: fullName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

      // 3. Xử lý Redirect như bình thường
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
