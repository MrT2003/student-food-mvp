import { createClient } from '@/lib/supabase/server';
import { ZaloAuthService } from '@/services/auth.service';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { log } from 'console';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

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
        const access_token = await ZaloAuthService.getZaloAccessToken(code, savedVerifier);
        // Extract profile from Zalo 
        const profile = await ZaloAuthService.getZaloProfile(access_token)

        // Delet temporary cookie
        cookieStore.delete('zalo_code_verifier');
        cookieStore.delete('zalo_auth_state');

        // Create virtual email and password represents for Zalo User to store into the supabase.auth table 
        const zaloEmail = `${profile.id}@zalo.app`
        const zaloPassword = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!)
            .update(profile.id)
            .digest('hex')


        // Init supabase admin client 
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )        

        // Immediately insert into the auth user 
        try {
            const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser(
                {
                    email: zaloEmail,
                    password: zaloPassword,
                    email_confirm: true,
                    // Base on the UI design, role can be added to the metadata
                    // user_metadata: {provider: "zalo", role: ""}
                }
            )

            // If successfully insert into auth table without error and this is new error then try to insert into the public.users
            // after that
            if (createError) {
                // Define the error is "Duplicate insert" in auth.users table
                const isUserExists = 
                    createError.status === 422 || 
                    createError.message.toLowerCase().includes('already registered') ||
                    createError.message.toLowerCase().includes('already exists')

                // If the error is not the duplicate insert error then immediately 
                // return the error without continue executing the next query
                if (!isUserExists) {
                    // DIFFERENT ERROR: (System, Network, Invalid data...)                    
                    console.error('Failed to insert into auth.users: ', createError.message)
                    return NextResponse.json(
                        { error: `[api/auth/zalo/callback] Faield to insert account into auth.users: ${createError.message}` }, 
                        { status: 500 }
                    )
                }

                // If error is duplicate insert then ignore and continue the below execution

            } else if (authData.user) {
                // Implement query to insert into public.users 
                const { error: dbError } = await supabaseAdmin.from('users').insert({
                    id: authData.user.id,
                    email: zaloEmail,
                    // full_name: profile.name,
                })

                if (dbError) {
                    // Rollback: Xóa user vừa tạo bên auth nếu chèn bảng users thất bại
                    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
                    console.error(`[api/auth/zalo/callback] Failed to insert into public.users: ${dbError.message}`)
                    return NextResponse.json(
                        { error: `Failed to store user into public.users` }, 
                        { status: 500 }
                    )
                }
            }

            // After successfully insert all user data to the auth.users and public.users
            // or get duplicate error when insert into auth.users, try to login the user
            // into the application and redirect them to the main page 
            
            // Init supabaseServer instance
            const supabaseServer = await createClient()

            // Try to login user immediately
            const { error: signInError } = await supabaseServer.auth.signInWithPassword({
                email: zaloEmail,
                password: zaloPassword
            })

            if (signInError) {
                return NextResponse.json({ error: "Failed to sign in" }, { status: 400 })
            }

            // Note : the "/" can be changed based on the design of system 
            // this should redirect to the main page or home page immediately
            NextResponse.redirect(new URL("/", request.url))

        } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 400 })
        }
        
        // Redirect to main page after successfully sign up
        return NextResponse.redirect("http://localhost:3000");
>>>>>>> Stashed changes
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
