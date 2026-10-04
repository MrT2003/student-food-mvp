import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from 'crypto'
import { ZaloAuthService } from "@/services/auth.service";

export async function GET() {
	const codeVerifier = ZaloAuthService.generateCodeVerifier();
	const codeChallenge = ZaloAuthService.generateCodeChallenge(codeVerifier);
	const state = crypto.randomBytes(16).toString('hex');

	const authUrl = ZaloAuthService.getAuthorizationUrl(codeChallenge, state)

	// Store code_verifier and state into temporary cookie ( with timeout = 10 minutes)
	const cookieStore = await cookies()

	cookieStore.set('zalo_code_verifier', codeVerifier, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: "lax",
		maxAge: 600,
		path: '/'
	});
	cookieStore.set('zalo_auth_state', state, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		// Cookie timeout is 10 minutes
		maxAge: 600,
		path: '/',
	});

	return NextResponse.redirect(authUrl);
}
