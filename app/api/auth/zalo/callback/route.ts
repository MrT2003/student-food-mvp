import { NextRequest, NextResponse } from 'next/server';
import { ZaloAuthService, type ZaloProfile } from '@/services/auth.service';

type CallbackResult = { error: string } | {
  message: string;
  profile: ZaloProfile;
  applicationSessionCreated: false;
};

function finish(body: CallbackResult, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  for (const name of ['zalo_code_verifier', 'zalo_auth_state']) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = params.get('state');
  const savedVerifier = request.cookies.get('zalo_code_verifier')?.value;
  const savedState = request.cookies.get('zalo_auth_state')?.value;

  if (!state || !savedState || !savedVerifier || state !== savedState) {
    console.info('[zalo-oauth]', JSON.stringify({ stage: 'callback_validation', kind: 'invalid_state_or_expired' }));
    return finish({ error: 'ZALO_INVALID_STATE_OR_EXPIRED' }, 400);
  }
  if (params.has('error')) {
    console.info('[zalo-oauth]', JSON.stringify({ stage: 'callback_validation', kind: 'authorization_denied' }));
    return finish({ error: 'ZALO_AUTHORIZATION_DENIED' }, 400);
  }
  const code = params.get('code');
  if (!code?.trim()) {
    console.info('[zalo-oauth]', JSON.stringify({ stage: 'callback_validation', kind: 'missing_code' }));
    return finish({ error: 'ZALO_MISSING_CODE' }, 400);
  }

  try {
    console.info('[zalo-oauth]', JSON.stringify({ stage: 'callback_validation', kind: 'passed' }));
    const { access_token } = await ZaloAuthService.getZaloAccessToken(code, savedVerifier);
    console.info('[zalo-oauth]', JSON.stringify({ stage: 'token_exchange', kind: 'passed' }));
    const profile = await ZaloAuthService.getZaloProfile(access_token);
    console.info('[zalo-oauth]', JSON.stringify({ stage: 'profile_validation', kind: 'passed' }));

    // Return only the normalized profile to the browser that initiated OAuth.
    // Retrieving a Zalo profile does not establish an application session.
    return finish({
      message: 'Lấy hồ sơ Zalo thành công',
      profile,
      applicationSessionCreated: false,
    }, 200);
  } catch {
    return finish({ error: 'ZALO_AUTHENTICATION_FAILED' }, 502);
  }
}
