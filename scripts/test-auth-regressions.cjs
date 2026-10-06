const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// No network, real credentials, or database writes are used by these tests.
function load(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, URL, setTimeout, clearTimeout,
    process: { env: {} },
    console: { error() {} },
    require(name) {
      assert.ok(name in mocks, `Unexpected dependency: ${name}`);
      return mocks[name];
    },
  });
  return exports;
}

async function callbackCase({ createError = null, profileError = null, state = 'valid' } = {}) {
  const calls = [];
  const route = load('app/api/auth/zalo/callback/route.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      signInWithPassword: async () => {
        calls.push('signin');
        return { data: { user: { id: 'auth-user' } }, error: null };
      },
    } }) },
    '@/services/zalo.service': { ZaloAuthService: {
      getZaloAccessToken: async () => {
        calls.push('provider');
        return { access_token: 'test-token' };
      },
      getZaloProfile: async () => ({ id: 'zalo-user', name: 'Test', img_url: null }),
    } },
    '@supabase/supabase-js': { createClient: () => ({
      auth: { admin: { createUser: async () => ({ error: createError }) } },
      from: (table) => ({ upsert: async (profile, options) => {
        assert.equal(table, 'users');
        assert.equal(profile.id, 'auth-user');
        assert.equal(options.onConflict, 'id');
        assert.equal(options.ignoreDuplicates, true);
        calls.push('profile');
        return { error: profileError };
      } }),
    }) },
    crypto: { createHmac: () => ({ update: () => ({ digest: () => 'test-password' }) }) },
    'next/headers': { cookies: async () => ({
      get: (key) => ({ value: key === 'zalo_auth_state' ? 'valid' : 'verifier' }),
      delete() {},
    }) },
    'next/server': { NextResponse: {
      json: (body, init) => ({ body, status: init.status }),
      redirect: (url) => ({ status: 307, url: String(url) }),
    } },
  });
  const url = new URL(`http://localhost:3000/api/auth/zalo/callback?code=test&state=${state}`);
  return { response: await route.GET({ nextUrl: url, url: String(url) }), calls };
}

(async () => {
  const { AuthClientService: auth } = load('services/auth.service.ts', {
    '@/lib/supabase/client': {},
  });
  const friendly = auth.getAuthErrorMessage({ code: 'USER_NOT_FOUND' });
  assert.equal(auth.getAuthErrorMessage({ code: 'P0001', message: 'USER_NOT_FOUND' }), friendly);
  assert.equal(auth.getAuthErrorMessage({ error: { code: 'P0001', message: 'USER_NOT_FOUND' } }), friendly);
  assert.notEqual(auth.getAuthErrorMessage({ message: 'Internal database details' }), 'Internal database details');

  for (const createError of [null, { code: 'email_exists', message: 'Account exists' }]) {
    const { response, calls } = await callbackCase({ createError });
    assert.equal(response.status, 307);
    assert.equal(response.url, 'http://localhost:3000/');
    assert.deepEqual(calls, ['provider', 'signin', 'profile']);
  }
  const invalid = await callbackCase({ state: 'invalid' });
  assert.equal(invalid.response.status, 400);
  assert.deepEqual(invalid.calls, []);
  const rejected = await callbackCase({ createError: { status: 422, message: 'Invalid email' } });
  assert.equal(rejected.response.status, 500);
  assert.deepEqual(rejected.calls, ['provider']);
  const failedProfile = await callbackCase({ profileError: { message: 'Database unavailable' } });
  assert.equal(failedProfile.response.status, 500);
  console.log('Auth regression checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
