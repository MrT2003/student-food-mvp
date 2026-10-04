import * as crypto from 'crypto';
import 'server-only';

export interface ZaloProfile {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validToken(value: unknown): value is string {
  return typeof value === 'string' && /^[\x21-\x7e]+$/.test(value);
}

type ZaloStage = 'token_exchange' | 'profile_request' | 'token_validation' | 'profile_validation';

function fail(stage: ZaloStage, kind: string, details: {
  httpStatus?: number; zaloError?: number; field?: string; networkCode?: string;
} = {}): never {
  // Only locally selected labels and numeric provider codes; never raw errors/data.
  console.error('[zalo-oauth]', JSON.stringify({ stage, kind, ...details }));
  throw new Error('ZALO_PROVIDER_REQUEST_FAILED');
}

function networkCode(error: unknown): string {
  const cause = isRecord(error) && isRecord(error.cause) ? error.cause : error;
  const code = isRecord(cause) ? cause.code : undefined;
  return typeof code === 'string' && [
    'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'EACCES', 'EPERM',
    'UND_ERR_CONNECT_TIMEOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID',
  ].includes(code) ? code : 'UNKNOWN';
}

async function requestZalo(stage: ZaloStage, url: string, options: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const timeout = isRecord(error) && ['TimeoutError', 'AbortError'].includes(String(error.name));
    return fail(stage, timeout ? 'timeout' : 'network', { networkCode: networkCode(error) });
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    const timeout = isRecord(error) && ['TimeoutError', 'AbortError'].includes(String(error.name));
    return fail(stage, timeout ? 'timeout' : response.ok ? 'invalid_json' : 'http', { httpStatus: response.status });
  }
  const rawCode = isRecord(data) ? data.error : undefined;
  const numericCode = typeof rawCode === 'number' ? rawCode
    : typeof rawCode === 'string' && /^-?\d{1,6}$/.test(rawCode) ? Number(rawCode) : undefined;
  const zaloError = Number.isSafeInteger(numericCode) && Math.abs(numericCode!) <= 999999 ? numericCode : undefined;
  if (!response.ok) return fail(stage, 'http', { httpStatus: response.status, zaloError });
  if (!isRecord(data)) return fail(stage, 'invalid_shape', { httpStatus: response.status });
  if (data.error !== undefined && data.error !== 0 && data.error !== '0') {
    return fail(stage, 'provider_error', { httpStatus: response.status, zaloError });
  }
  return data;
}

export const ZaloAuthService = {
  generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  },

  generateCodeChallenge(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier, 'ascii').digest('base64url');
  },

  getAuthorizationUrl(codeChallenge: string, state: string): string {
    const appId = process.env.ZALO_APP_ID;
    const redirectUri = process.env.NODE_ENV === 'production'
      ? process.env.ZALO_CALLBACK_URL_PRODUCT
      : process.env.ZALO_CALLBACK_URL_DEV;
    if (!appId || !redirectUri) throw new Error('ZALO_CONFIGURATION_MISSING');
    const params = new URLSearchParams({
      app_id: appId, redirect_uri: redirectUri, code_challenge: codeChallenge, state,
    });
    return `https://oauth.zaloapp.com/v4/permission?${params}`;
  },

  async getZaloAccessToken(code: string, codeVerifier: string): Promise<{ access_token: string }> {
    const appId = process.env.ZALO_APP_ID;
    const secret = process.env.ZALO_SECRET_KEY;
    if (!appId || !secret) return fail('token_exchange', 'missing_configuration', { field: !appId ? 'ZALO_APP_ID' : 'ZALO_SECRET_KEY' });
    const data = await requestZalo('token_exchange', 'https://oauth.zaloapp.com/v4/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', secret_key: secret },
      body: new URLSearchParams({
        code, app_id: appId, grant_type: 'authorization_code', code_verifier: codeVerifier,
      }),
    });
    if (!validToken(data.access_token)) {
      console.error('[zalo-oauth]', JSON.stringify({ stage: 'token_validation', kind: 'invalid_field', field: 'access_token' }));
      throw new Error('ZALO_INVALID_ACCESS_TOKEN');
    }
    return { access_token: data.access_token };
  },

  async getZaloProfile(accessToken: string): Promise<ZaloProfile> {
    if (!validToken(accessToken)) throw new Error('ZALO_INVALID_ACCESS_TOKEN');
    const data = await requestZalo('profile_request', 'https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
      method: 'GET',
      headers: { access_token: accessToken },
    });
    // IDs are opaque strings scoped to the app, not auth.users UUIDs.
    if (typeof data.id !== 'string' || !data.id || /\s|[\x00-\x1f\x7f]/.test(data.id)) {
      console.error('[zalo-oauth]', JSON.stringify({ stage: 'profile_validation', kind: 'invalid_field', field: 'id' }));
      throw new Error('ZALO_INVALID_PROFILE');
    }
    const picture = isRecord(data.picture) && isRecord(data.picture.data) ? data.picture.data : null;
    let avatarUrl = optionalText(picture?.url);
    if (avatarUrl) {
      try {
        const url = new URL(avatarUrl);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) avatarUrl = null;
      } catch {
        avatarUrl = null;
      }
    }
    return { id: data.id, name: optionalText(data.name), avatar_url: avatarUrl };
  },
};

export const GoogleAuthService = {};
