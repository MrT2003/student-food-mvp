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
    exports, require: (id) => { if (id === 'server-only') return {}; if (id in mocks) return mocks[id]; if (id === '@/utilities/auth.utility') return load('../utilities/auth.utility.ts'); if (id === '@/utilities/system.utility') return load('../utilities/system.utility.ts'); if (id.startsWith('@/')) throw new Error('Unmocked application dependency'); return require(id); },
    Buffer, Date, console: { error() {}, log() { throw new Error('Must not log raw errors'); } },
    fetch() { throw new Error('Unexpected real network request'); },
    URL, URLSearchParams, AbortSignal,
    process: { env: { ZALO_APP_ID: 'test-app', ZALO_SECRET_KEY: 'test-secret' } },
    ...globals,
  });
  return exports;
}

function service(fetch) {
  return load('../services/zalo-provider.service.ts', {}, { fetch }).ZaloProviderService;
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
  assert.equal(JSON.stringify(await api.getZaloProfile('test-token')), JSON.stringify({ id: 'user-123', name: ' Alice ', img_url: 'https://example.com/a.png' }));
});

for (const picture of [undefined, null, {}, { data: null }, { data: { url: 'javascript:bad' } }]) {
  test(`optional fields normalize to null: ${JSON.stringify(picture)}`, async () => {
    const result = await service(async () => Response.json({ id: 'user-123', name: 'Fixture', picture })).getZaloProfile('test-token');
    assert.equal(result.name, "Fixture");
    assert.equal(result.img_url, "");
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
    await assert.rejects(api.getZaloAccessToken('code', 'verifier'), /ZALO_PROVIDER_REQUEST_FAILED/);
    await assert.rejects(api.getZaloProfile(access_token), /ZALO_PROVIDER_REQUEST_FAILED/);
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

for (const [label, response, expected] of [
  ['provider error', () => Response.json({ error: -14014, message: 'DO_NOT_LOG', access_token: 'DO_NOT_LOG' }), { stage: 'token_exchange', kind: 'provider_error', httpStatus: 200, zaloErrorCode: -14014 }],
  ['HTTP JSON error', () => Response.json({ error: 210, message: 'DO_NOT_LOG' }, { status: 403 }), { stage: 'token_exchange', kind: 'http_request', httpStatus: 403, zaloErrorCode: 210 }],
  ['invalid JSON', () => new Response('DO_NOT_LOG'), { stage: 'token_exchange', kind: 'invalid_json', httpStatus: 200 }],
  ['network', () => { throw Object.assign(new Error('DO_NOT_LOG'), { cause: { code: 'ECONNRESET', message: 'DO_NOT_LOG' } }); }, { stage: 'token_exchange', kind: 'network', networkCode: 'ECONNRESET' }],
  ['timeout', () => { throw Object.assign(new Error('DO_NOT_LOG'), { name: 'TimeoutError' }); }, { stage: 'token_exchange', kind: 'timeout', networkCode: 'UNKNOWN' }],
]) {
  test(`safe diagnostics distinguish ${label}`, async () => {
    const logs = [];
    const api = load('../services/zalo-provider.service.ts', {}, {
      fetch: async () => response(),
      console: { error: (prefix, details) => logs.push([prefix, JSON.parse(details)]) },
    }).ZaloProviderService;
    await assert.rejects(api.getZaloAccessToken('DO_NOT_LOG', 'DO_NOT_LOG'), /ZALO_PROVIDER_REQUEST_FAILED/);
    assert.deepEqual(logs, [['[services][zalo.service.ts] ', expected]]);
    assert.ok(!JSON.stringify(logs).includes('DO_NOT_LOG'));
  });
}

// Reproduced on this machine: sandbox egress denied the Zalo request with EACCES.
test('reports sandbox egress denial safely without retrying token exchange', async () => {
  const logs = [];
  let attempts = 0;
  const api = load('../services/zalo-provider.service.ts', {}, {
    fetch: async () => { attempts++; throw Object.assign(new Error('fetch failed'), { cause: { code: 'EACCES' } }); },
    console: { error: (prefix, details) => logs.push([prefix, JSON.parse(details)]) },
  }).ZaloProviderService;
  await assert.rejects(api.getZaloAccessToken('private-code', 'private-verifier'), /ZALO_PROVIDER_REQUEST_FAILED/);
  assert.equal(attempts, 1);
  assert.deepEqual(logs, [['[services][zalo.service.ts] ', { stage: 'token_exchange', kind: 'network', networkCode: 'EACCES' }]]);
});

function flowFixture(options = {}) {
  const jar = new Map(), calls = [], logs = [];
  const cookies = { get: n => jar.has(n) ? { value: jar.get(n) } : undefined,
    set: (n,v,o) => { jar.set(n,v); calls.push({ cookieOptions:o }); }, delete: n => jar.delete(n) };
  const api = service(async () => { throw new Error('Network must remain mocked'); });
  const flow = load('../lib/auth/zalo-flow.ts', { 'next/headers': { cookies: async () => cookies }, '@/services/zalo-provider.service': api ? { ZaloProviderService: api } : {} }, {
    process: { env: { SUPABASE_SERVICE_ROLE_KEY: 'synthetic-signing-material-only' } },
  });
  const intent = { mode: options.link ? 'link' : 'login', userId: options.link ? 'fixture-user' : null,
    state: 'fixture-state', code_verifier: 'fixture-verifier', expiresAt: Date.now()+600000 };
  const issue = patch => flow.encodeZaloFlow({ ...intent,...patch });
  jar.set(flow.ZALO_FLOW_COOKIE, options.cookie ?? issue());
  const provider = { async getZaloAccessToken() { calls.push('exchange'); if(options.failure===1) throw new Error('PRIVATE'); return {access_token:'synthetic-token'}; },
    async getZaloProfile() { calls.push('profile'); if(options.failure===2) throw new Error('PRIVATE'); return {id:'123',name:'Fixture',img_url:''}; } };
  const account = { hasGoogleIdentity: u => u.identities?.some(i=>i.provider==='google'),
    async loginWithVerifiedZalo() { calls.push('session'); if(options.accountError) throw new Error(options.accountError); },
    async linkZaloAccount() { calls.push('link'); if(options.accountError) throw new Error(options.accountError); } };
  const mocks = { '@/lib/auth/zalo-flow':flow, 'next/headers':{cookies:async()=>cookies},
    '@/lib/supabase/admin':{ createAdminClient:()=>({}) },
    '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:options.noUser?null:{id:options.changed?'other':'fixture-user',identities:options.noGoogle?[]:[{provider:'google'}]}},error:null})}})},
    '@/services/zalo-provider.service':{ZaloProviderService:provider}, '@/services/zalo-account.service':{ZaloAccountService:account} };
  const {GET}=load('../app/api/auth/zalo/callback/route.ts',mocks,{console:{error:(...args)=>logs.push(args),log(){throw Error('Raw log forbidden');}}});
  return {flow,jar,calls,logs,issue,intent, async run(query='state=fixture-state&code=synthetic-code') {
    const response = await GET(new NextRequest('https://example.com/api/auth/zalo/callback?'+query));
    assert.equal(response.headers.get('cache-control'),'no-store'); assert.equal(response.headers.get('referrer-policy'),'no-referrer'); return response;
  }};
}
for(const kind of ['missing','tampered','expired','wrong-state']) test('callback rejects invalid intent: '+kind, async()=>{
 const f=flowFixture(); if(kind==='missing')f.jar.clear();if(kind==='tampered')f.jar.set(f.flow.ZALO_FLOW_COOKIE,f.issue()+'x');if(kind==='expired')f.jar.set(f.flow.ZALO_FLOW_COOKIE,f.issue({expiresAt:Date.now()-1}));
 const r=await f.run(kind==='wrong-state'?'state=wrong&code=synthetic-code':undefined);assert.equal(r.status,400);assert.equal(f.calls.length,0);assert.equal((await r.text()).includes('PRIVATE'),false);
});
for(const link of [false,true]){
 test('callback completes verified '+(link?'link':'application session'),async()=>{const f=flowFixture({link});const r=await f.run();assert.equal(r.status,307);assert.equal(new URL(r.headers.get('location')).pathname,link?'/account':'/');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(f.jar.has(f.flow.ZALO_FLOW_COOKIE),false);assert.deepEqual(f.calls,['exchange','profile',link?'link':'session']);assert.equal((await r.text()).includes('synthetic-token'),false);});
 for(const query of ['state=fixture-state','state=fixture-state&error=access_denied'])test('cancel/missing code never falls back to login: '+link+' '+(query.includes('error')?'denied':'missing'),async()=>{const f=flowFixture({link});const r=await f.run(query);assert.equal(r.status,307);assert.equal(new URL(r.headers.get('location')).pathname,link?'/account':'/auth/login');assert.equal(f.calls.length,0);assert.equal(f.jar.size,0);});
 for(const failure of [1,2])test('provider failure safely terminates intent: '+link+' stage '+failure,async()=>{const f=flowFixture({link,failure});const r=await f.run();assert.equal(r.status,link?307:500);assert.equal(f.jar.size,0);assert.equal(f.calls.includes('session'),false);assert.equal(f.calls.includes('link'),false);assert.equal(JSON.stringify(f.logs).includes('PRIVATE'),false);assert.equal((await r.text()).includes('PRIVATE'),false);});
}
for(const option of ['noUser','changed','noGoogle'])test('link rejects changed identity: '+option,async()=>{const f=flowFixture({link:true,[option]:true});const r=await f.run();assert.equal(new URL(r.headers.get('location')).searchParams.get('zalo_link'),'session_changed');assert.equal(f.calls.length,0);});
for(const conflict of ['ZALO_ALREADY_LINKED','ACCOUNT_ALREADY_HAS_ZALO','PRIVATE'])test('link handles account failure category '+(conflict==='PRIVATE'?'unknown':conflict),async()=>{const f=flowFixture({link:true,accountError:conflict});const r=await f.run();assert.equal(new URL(r.headers.get('location')).searchParams.get('zalo_link'),conflict==='PRIVATE'?'failed':'conflict');assert.equal(f.calls.includes('session'),false);});
test('account failure never logs upstream payload',async()=>{const f=flowFixture({accountError:'PRIVATE'});const r=await f.run();assert.equal(r.status,500);assert.equal(JSON.stringify(f.logs).includes('PRIVATE'),false);});
test('login uses real signed flow, PKCE, expiry and secure cookie flags',async()=>{
 const jar=new Map();let options;
 const api=load('../services/zalo-provider.service.ts',{}, {process:{env:{ZALO_APP_ID:'synthetic-app',ZALO_CALLBACK_URL_PRODUCT:'https://example.com/api/auth/zalo/callback',NODE_ENV:'production'}}}).ZaloProviderService;
 const flow=load('../lib/auth/zalo-flow.ts',{'next/headers':{cookies:async()=>({set:(n,v,o)=>{jar.set(n,v);options=o;}})},'@/services/zalo-provider.service':{ZaloProviderService:api}}, {process:{env:{SUPABASE_SERVICE_ROLE_KEY:'synthetic-signing-material-only',NODE_ENV:'production'}}});
 const {GET}=load('../app/api/auth/zalo/login/route.ts',{'@/lib/auth/zalo-flow':flow});const r=await GET();assert.equal(r.status,307);const url=new URL(r.headers.get('location'));const intent=flow.decodeZaloFlow(jar.get(flow.ZALO_FLOW_COOKIE));assert.ok(intent);assert.equal(url.searchParams.get('state')===intent.state,true);assert.equal(url.searchParams.get('code_challenge')===api.generateCodeChallenge(intent.code_verifier),true);assert.ok(intent.expiresAt>Date.now()&&intent.expiresAt<=Date.now()+600000);assert.ok(options.httpOnly&&options.secure);assert.equal(options.sameSite,'lax');assert.equal(options.maxAge,600);assert.equal(options.path,'/');assert.equal(r.headers.get('cache-control'),'no-store');
});
test('login configuration failure is sanitized',async()=>{const {GET}=load('../app/api/auth/zalo/login/route.ts',{'@/lib/auth/zalo-flow':{async beginZaloFlow(){throw Error('PRIVATE');}}});const r=await GET();assert.equal(r.status,503);assert.equal((await r.text()).includes('PRIVATE'),false);});

test('consumed intent cannot be replayed from the cookie jar',async()=>{const f=flowFixture();await f.run();const before=f.calls.length;const r=await f.run();assert.equal(r.status,400);assert.equal(f.calls.length,before);});
for(const patch of [{mode:'other'},{userId:'unexpected'},{expiresAt:0}])test('signed malformed intent is rejected category '+Object.keys(patch)[0],()=>{const f=flowFixture();assert.equal(f.flow.decodeZaloFlow(f.issue(patch)),null);});
