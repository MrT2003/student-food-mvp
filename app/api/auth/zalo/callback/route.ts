import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ZaloAuthService } from "@/services/zalo.service";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedVerifier = cookieStore.get("zalo_code_verifier")?.value;
  const savedState = cookieStore.get("zalo_auth_state")?.value;

  if (!code || !state) {
    return NextResponse.json(
      { error: "code or state params does not exist !" },
      { status: 400 },
    );
  }

  // Verify saved state in cookie
  if (!savedVerifier || !savedState || state !== savedState) {
    return NextResponse.json(
      { error: "Invalid state or session time out !" },
      { status: 400 },
    );
  }

  try {
    const access_token = (
      await ZaloAuthService.getZaloAccessToken(code, savedVerifier)
    ).access_token;
    const { id, name, img_url } =
      await ZaloAuthService.getZaloProfile(access_token);

    // Delete temporary cookies
    cookieStore.delete("zalo_code_verifier");
    cookieStore.delete("zalo_auth_state");

    const zaloEmail = `${id}@zalo.app`;
    const zaloPassword = crypto
      .createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
      .update(id)
      .digest("hex");

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    try {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: zaloEmail,
        password: zaloPassword,
        email_confirm: true,
      });

      if (createError) {
        const isUserExists =
          createError.status === 422 ||
          createError.message.toLowerCase().includes("already registered") ||
          createError.message.toLowerCase().includes("already exists");

        if (!isUserExists) {
          console.error(
            "Failed to insert into auth.users: ",
            createError.message,
          );
          return NextResponse.json(
            {
              error: `[api/auth/zalo/callback] Failed to insert account: ${createError.message}`,
            },
            { status: 500 },
          );
        }
      }

      const supabaseServer = await createClient();

      const { data: signInData, error: signInError } =
        await supabaseServer.auth.signInWithPassword({
          email: zaloEmail,
          password: zaloPassword,
        });

      if (signInError || !signInData.user) {
        return NextResponse.json(
          { error: "Failed to sign in" },
          { status: 400 },
        );
      }

      // Upsert vào bảng public.users
      const { error: profileError } = await supabaseAdmin.from("users").upsert(
        {
          id: signInData.user.id,
          role: "student",
          name,
          avatar_url: img_url || null,
        },
        {
          onConflict: "id",
          ignoreDuplicates: true,
        },
      );

      if (profileError) {
        console.error(
          "[api/auth/zalo/callback] Failed to ensure public profile:",
          profileError,
        );
        return NextResponse.json(
          { error: "Failed to ensure public user profile" },
          { status: 500 },
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
