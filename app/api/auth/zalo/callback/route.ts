import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ZaloAuthService } from '@/services/auth.service'; // Dùng từ services[cite: 1]

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    const cookieStore = await cookies();
    const savedVerifier = cookieStore.get('zalo_code_verifier')?.value;
    const savedState = cookieStore.get('zalo_auth_state')?.value;

    if (!code || !state) {
        return NextResponse.json({ error: 'code or state params does not exist !' }, { status: 400 });
    }

    // Verify saved state in cookie with the cookie in the callback link 
    // if it not similar then return error immediately --> Limit call to Zalo API ---> Reduce bottleneck and workload of server
    if (!savedVerifier || !savedState || state !== savedState) {
        return NextResponse.json({ error: 'Invalid state or session time out !' }, { status: 400 });
    }

    try {
        // Extract access token from Zalo
        const data = await ZaloAuthService.getZaloAccessToken(code, savedVerifier);
        const access_token = data.access_token;
        const refresh_token = data.refresh_token;

        // Delet temporary cookie
        cookieStore.delete('zalo_code_verifier');
        cookieStore.delete('zalo_auth_state');

        // Logic lưu token / thông tin người dùng vào database / Supabase ở đây...

        // Redirect to main page after successfully sign up
        return NextResponse.redirect(new URL('/', request.url));
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}