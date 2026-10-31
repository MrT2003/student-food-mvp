import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');

// Compile the real modules in isolation; never read .env or contact the provider.
function load(file, mocks = {}, globals = {}) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, require: (id) => id === 'server-only' ? {} : mocks[id] ?? require(id),
    URL, URLSearchParams, AbortSignal,
    process: { env: { ZALO_APP_ID: 'test-app', ZALO_SECRET_KEY: 'test-secret' } },
    ...globals,
  });
  return exports;
}

function service(fetch) {
  return load('../services/auth.service.ts', {}, { fetch }).ZaloAuthService;
}

const profile = { error: 0, id: 'user-123', name: ' Alice ', picture: { data: { url: 'https://example.com/a.png' } } };
test('profile request uses header, exact fields, no cache and timeout', async () => {
  const api = service(async (url, options) => {
    assert.equal(url, 'https://graph.zalo.me/v2.0/me?fields=id,name,picture');
    assert.equal(options.headers.access_token, 'test-token');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(profile);
  });
  assert.equal(JSON.stringify(await api.getZaloProfile('test-token')), JSON.stringify({ id: 'user-123', name: 'Alice', avatar_url: 'https://example.com/a.png' }));
});

for (const picture of [undefined, null, {}, { data: null }, { data: { url: 'javascript:bad' } }]) {
  test(`optional fields normalize to null: ${JSON.stringify(picture)}`, async () => {
    const result = await service(async () => Response.json({ id: 'user-123', picture })).getZaloProfile('test-token');
    assert.equal(result.name, null);
    assert.equal(result.avatar_url, null);
  });
}

for (const [label, fetch] of [
  ['HTTP error', async () => Response.json({ message: 'sensitive' }, { status: 401 })],
  ['business error', async () => Response.json({ ...profile, error: 210, message: 'sensitive' })],
  ['malformed JSON', async () => new Response('not json')],
  ['array JSON', async () => Response.json([])],
  ['null JSON', async () => Response.json(null)],
  ['missing ID', async () => Response.json({ name: 'Alice' })],
  ['numeric ID', async () => Response.json({ id: 123 })],
  ['blank ID', async () => Response.json({ id: ' ' })],
  ['network/timeout', async () => { throw new Error('sensitive'); }],
]) {
  test(`rejects ${label} without echoing upstream details`, async () => {
    await assert.rejects(service(fetch).getZaloProfile('test-token'), (error) => {
      assert.match(error.message, /^ZALO_/);
      assert.ok(!error.message.includes('sensitive'));
      return true;
    });
  });
}

for (const access_token of [undefined, '', ' ', 'bad\r\ntoken', 123]) {
  test(`rejects invalid access token ${JSON.stringify(access_token)}`, async () => {
    const api = service(async () => Response.json({ access_token, refresh_token: 'unused' }));
    await assert.rejects(api.getZaloAccessToken('code', 'verifier'), /ZALO_INVALID_ACCESS_TOKEN/);
    await assert.rejects(api.getZaloProfile(access_token), /ZALO_INVALID_ACCESS_TOKEN/);
  });
}

test('token exchange drops unused refresh token and has no cache', async () => {
  const api = service(async (url, options) => {
    assert.equal(url, 'https://oauth.zaloapp.com/v4/access_token');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.body.get('code_verifier'), 'verifier');
    return Response.json({ access_token: 'test-token', refresh_token: 'unused' });
  });
  assert.equal(JSON.stringify(await api.getZaloAccessToken('code', 'verifier')), '{"access_token":"test-token"}');
});

for (const [query, cookie, expected, calls] of [
  ['code=code', 'zalo_auth_state=state; zalo_code_verifier=verifier', 400, 0],
  ['code=code&state=wrong', 'zalo_auth_state=state; zalo_code_verifier=verifier', 400, 0],
  ['code=code&state=state', '', 400, 0],
  ['code=code&state=state', 'zalo_auth_state=state', 400, 0],
  ['error=access_denied&state=state', 'zalo_auth_state=state; zalo_code_verifier=verifier', 400, 0],
  ['state=state', 'zalo_auth_state=state; zalo_code_verifier=verifier', 400, 0],
  ['code=code&state=state', 'zalo_auth_state=state; zalo_code_verifier=verifier', 200, 2],
]) {
  test(`callback ${query} / ${cookie || 'expired cookies'}`, async () => {
    let count = 0;
    const api = service(async () => Response.json(++count === 1
      ? { access_token: 'test-token', refresh_token: 'test-refresh-token' }
      : { ...profile, access_token: 'test-token', secret: 'test-secret' }));
    const { GET } = load('../app/api/auth/zalo/callback/route.ts', { '@/services/auth.service': { ZaloAuthService: api } });
    const response = await GET(new NextRequest(`https://example.com/api/auth/zalo/callback?${query}`, { headers: { cookie } }));
    assert.equal(response.status, expected);
    assert.equal(count, calls);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Location'), null);
    for (const name of ['zalo_auth_state', 'zalo_code_verifier']) assert.equal(response.cookies.get(name).maxAge, 0);
    const body = await response.text();
    for (const secret of ['test-token', 'test-refresh-token', 'test-secret']) assert.ok(!body.includes(secret));
    if (expected === 200) {
      // Only PKCE/state cookies were supplied; no Supabase session is required.
      assert.deepEqual(JSON.parse(body), {
        message: 'Lấy hồ sơ Zalo thành công',
        profile: { id: 'user-123', name: 'Alice', avatar_url: 'https://example.com/a.png' },
        applicationSessionCreated: false,
      });
      assert.deepEqual(response.cookies.getAll().map(({ name }) => name).sort(), ['zalo_auth_state', 'zalo_code_verifier']);
    } else {
      assert.ok(!body.includes('Alice'));
    }
  });
}

for (const [label, tokenResponse, profileResponse, expectedStatus] of [
  ['missing picture and name', { access_token: 'test-token' }, { id: 'user-123' }, 200],
  ['missing ID', { access_token: 'test-token' }, { name: 'Alice' }, 502],
  ['invalid token', { access_token: ' ', refresh_token: 'test-refresh-token' }, profile, 502],
  ['token business error', { access_token: 'test-token', error: -1 }, profile, 502],
  ['profile business error', { access_token: 'test-token' }, { ...profile, error: 210 }, 502],
  ['profile HTTP error', { access_token: 'test-token' }, new Response('sensitive', { status: 403 }), 502],
  ['profile invalid JSON', { access_token: 'test-token' }, new Response('sensitive'), 502],
]) {
  test(`callback handles ${label}`, async () => {
    let count = 0;
    const api = service(async () => {
      if (++count === 1) return Response.json(tokenResponse);
      return profileResponse instanceof Response ? profileResponse : Response.json(profileResponse);
    });
    const { GET } = load('../app/api/auth/zalo/callback/route.ts', { '@/services/auth.service': { ZaloAuthService: api } });
    const response = await GET(new NextRequest('https://example.com/?code=code&state=state', {
      headers: { cookie: 'zalo_auth_state=state; zalo_code_verifier=verifier' },
    }));
    assert.equal(response.status, expectedStatus);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    for (const name of ['zalo_auth_state', 'zalo_code_verifier']) assert.equal(response.cookies.get(name).maxAge, 0);
    const body = await response.text();
    for (const secret of ['test-token', 'test-refresh-token', 'sensitive']) assert.ok(!body.includes(secret));
    if (expectedStatus === 200) {
      assert.deepEqual(JSON.parse(body).profile, { id: 'user-123', name: null, avatar_url: null });
    } else {
      assert.deepEqual(JSON.parse(body), { error: 'ZALO_AUTHENTICATION_FAILED' });
    }
  });
}

for (const failAt of [1, 2]) {
  test(`callback failure at provider call ${failAt} clears cookies`, async () => {
    let count = 0;
    const api = service(async () => {
      if (++count === failAt) throw new Error('sensitive');
      return Response.json({ access_token: 'test-token' });
    });
    const { GET } = load('../app/api/auth/zalo/callback/route.ts', { '@/services/auth.service': { ZaloAuthService: api } });
    const response = await GET(new NextRequest('https://example.com/?code=code&state=state', { headers: { cookie: 'zalo_auth_state=state; zalo_code_verifier=verifier' } }));
    assert.equal(response.status, 502);
    assert.equal(count, failAt);
    assert.equal(response.cookies.get('zalo_auth_state').maxAge, 0);
    assert.equal(response.cookies.get('zalo_code_verifier').maxAge, 0);
    assert.equal(await response.text(), '{"error":"ZALO_AUTHENTICATION_FAILED"}');
  });
}

test('login uses URL-safe state and ten-minute HTTP-only PKCE cookies', async () => {
  const written = new Map();
  const api = load('../services/auth.service.ts', {}, {
    process: { env: { ZALO_APP_ID: 'test-app', ZALO_CALLBACK_URL_DEV: 'https://example.com/callback' } },
  }).ZaloAuthService;
  const { GET } = load('../app/api/auth/zalo/login/route.ts', {
    '@/services/auth.service': { ZaloAuthService: api },
    'next/headers': { cookies: async () => ({ set: (name, value, options) => written.set(name, { value, ...options }) }) },
  });
  const response = await GET();
  const url = new URL(response.headers.get('location'));
  const state = written.get('zalo_auth_state');
  const verifier = written.get('zalo_code_verifier');
  assert.match(state.value, /^[a-f0-9]{32}$/);
  assert.match(verifier.value, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(url.searchParams.get('state'), state.value);
  assert.equal(url.searchParams.get('code_challenge'), api.generateCodeChallenge(verifier.value));
  for (const cookie of written.values()) {
    assert.equal(cookie.maxAge, 600);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'lax');
    assert.equal(cookie.path, '/');
  }
});


for (const [label, response, expected] of [
  ['provider error', () => Response.json({ error: -14014, message: 'DO_NOT_LOG', access_token: 'DO_NOT_LOG' }), { stage: 'token_exchange', kind: 'provider_error', httpStatus: 200, zaloError: -14014 }],
  ['HTTP JSON error', () => Response.json({ error: 210, message: 'DO_NOT_LOG' }, { status: 403 }), { stage: 'token_exchange', kind: 'http', httpStatus: 403, zaloError: 210 }],
  ['invalid JSON', () => new Response('DO_NOT_LOG'), { stage: 'token_exchange', kind: 'invalid_json', httpStatus: 200 }],
  ['network', () => { throw Object.assign(new Error('DO_NOT_LOG'), { cause: { code: 'ECONNRESET', message: 'DO_NOT_LOG' } }); }, { stage: 'token_exchange', kind: 'network', networkCode: 'ECONNRESET' }],
  ['timeout', () => { throw Object.assign(new Error('DO_NOT_LOG'), { name: 'TimeoutError' }); }, { stage: 'token_exchange', kind: 'timeout', networkCode: 'UNKNOWN' }],
]) {
  test(`safe diagnostics distinguish ${label}`, async () => {
    const logs = [];
    const api = load('../services/auth.service.ts', {}, {
      fetch: async () => response(),
      console: { error: (prefix, details) => logs.push([prefix, JSON.parse(details)]) },
    }).ZaloAuthService;
    await assert.rejects(api.getZaloAccessToken('DO_NOT_LOG', 'DO_NOT_LOG'), /ZALO_PROVIDER_REQUEST_FAILED/);
    assert.deepEqual(logs, [['[zalo-oauth]', expected]]);
    assert.ok(!JSON.stringify(logs).includes('DO_NOT_LOG'));
  });
}

// Reproduced on this machine: sandbox egress denied the Zalo request with EACCES.
test('reports sandbox egress denial safely without retrying token exchange', async () => {
  const logs = [];
  let attempts = 0;
  const api = load('../services/auth.service.ts', {}, {
    fetch: async () => { attempts++; throw Object.assign(new Error('fetch failed'), { cause: { code: 'EACCES' } }); },
    console: { error: (prefix, details) => logs.push([prefix, JSON.parse(details)]) },
  }).ZaloAuthService;
  await assert.rejects(api.getZaloAccessToken('private-code', 'private-verifier'), /ZALO_PROVIDER_REQUEST_FAILED/);
  assert.equal(attempts, 1);
  assert.deepEqual(logs, [['[zalo-oauth]', { stage: 'token_exchange', kind: 'network', networkCode: 'EACCES' }]]);
});
