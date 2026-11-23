import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { create } from 'zustand';
function load(file, mocks, globals = {}) {
 let source = stripTypeScriptTypes(readFileSync(new URL(file, import.meta.url), 'utf8'));
 const names = [...source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map(m => m[1]);
 source = source.replace(/import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["'];/g, (_, names, id) => `const {${names}}=require(${JSON.stringify(id)});`).replace(/\bexport\s+/g, '');
 return new Function('require', ...Object.keys(globals), source + `;return {${names.join(',')}};`)(id => mocks[id] ?? assert.fail(id), ...Object.values(globals));
}
const id = '11111111-1111-4111-8111-111111111111';
function client(fetch) {
 const auth = create(() => ({ user: { id: 'buyer' }, logoutStatus: 'idle' }));
 const timers = new Map(); let next = 0;
 const store = load('../store/useNotificationInbox.ts', { zustand: { create }, './useAuthStore': { useAuthStore: auth } }, {
  fetch, setTimeout: fn => { timers.set(++next, fn); return next; }, clearTimeout: key => timers.delete(key),
 });
 return { ...store, auth, timers };
}
const response = data => Response.json(data);
test('inbox shares in-flight request and caches successful count for 60 seconds', async () => {
 let release, calls = 0;
 const c = client(() => { calls++; return new Promise(resolve => release = resolve); });
 const a = c.fetchInbox(), b = c.fetchInbox();
 await Promise.resolve(); assert.equal(calls, 1);
 release(response({ unreadCount: 4 })); await Promise.all([a, b]);
 await c.fetchInbox(); assert.equal(calls, 1); assert.equal(c.useNotificationInbox.getState().unreadCount, 4);
});
test('old account response cannot populate new account inbox', async () => {
 let release;
 const c = client(() => new Promise(resolve => release = resolve));
 const job = c.fetchInbox(); await Promise.resolve();
 c.auth.setState({ user: { id: 'other' } });
 release(response({ unreadCount: 99 })); await job;
 assert.equal(c.useNotificationInbox.getState().userId, 'other');
 assert.equal(c.useNotificationInbox.getState().unreadCount, 0);
});
test('failed read preserves unread; repeated clicks share one mutation', async () => {
 let writes = 0, fail = true;
 const c = client(async (_url, init) => {
  if (init.method === 'POST') { writes++; return fail ? Response.json({ error: 'offline' }, { status: 503 }) : response({ unreadCount: 0 }); }
  return response({ unreadCount: 1, items: [{ id, is_read: false }], nextCursor: null });
 });
 await c.fetchInbox(true);
 assert.equal(await c.markNotificationRead(id), false);
 assert.equal(c.useNotificationInbox.getState().items[0].is_read, false);
 fail = false;
 const a = c.markNotificationRead(id), b = c.markNotificationRead(id);
 assert.equal(a, b); await a;
 assert.equal(writes, 2); assert.equal(c.useNotificationInbox.getState().items[0].is_read, true);
 assert.equal(c.useNotificationInbox.getState().unreadCount, 0);
});
test('FCM burst invalidates cache and schedules only one refresh', async () => {
 let calls = 0;
 const c = client(async () => { calls++; return response({ unreadCount: calls }); });
 await c.fetchInbox();
 c.notificationArrived(id); c.notificationArrived(id); c.notificationArrived('another');
 assert.equal(c.timers.size, 1);
 await [...c.timers.values()][0]();
 assert.equal(calls, 2);
});
function route({ loggedIn = true, sameOrigin = true } = {}) {
 const queries = [];
 const admin = { from(table) {
  const ops = [['from', table]]; queries.push(ops);
  const q = { then(resolve) { return Promise.resolve({ count: 2, data: [], error: null }).then(resolve); } };
  for (const method of ['select', 'eq', 'order', 'limit', 'or', 'update']) q[method] = (...args) => { ops.push([method, ...args]); return q; };
  return q;
 }};
 return { queries, ...load('../app/api/notifications/inbox/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: loggedIn ? { id: 'session-owner' } : null }, error: null }) } }) },
  '@/lib/supabase/admin': { createAdminClient: () => admin },
  '@/lib/http/request-origin': { isSameOrigin: () => sameOrigin },
 }) };
}
test('API rejects anonymous/cross-origin requests before accessing notifications', async () => {
 const a = route({ loggedIn: false }); assert.equal((await a.GET(new Request('https://app.test/api/notifications/inbox'))).status, 401); assert.equal(a.queries.length, 0);
 const b = route({ sameOrigin: false }); assert.equal((await b.POST(new Request('https://app.test/api/notifications/inbox', { method: 'POST' }))).status, 403); assert.equal(b.queries.length, 0);
});
test('API scopes every query to session owner, ignores spoofed user and only changes is_read', async () => {
 const r = route();
 await r.GET(new Request('https://app.test/api/notifications/inbox?list=1&userId=victim'));
 const res = await r.POST(new Request('https://app.test/api/notifications/inbox', { method: 'POST', body: JSON.stringify({ id, userId: 'victim', title: 'changed' }) }));
 assert.equal(res.status, 200);
 for (const query of r.queries) assert.ok(query.some(op => op[0] === 'eq' && op[1] === 'user_id' && op[2] === 'session-owner'));
 assert.deepEqual(r.queries.flat().find(op => op[0] === 'update')[1], { is_read: true });
});
test('API rejects cursor filter injection', async () => {
 const r = route();
 const cursor = JSON.stringify({ id, created_at: 'now),user_id.neq.x' });
 assert.equal((await r.GET(new Request('https://app.test/api/notifications/inbox?list=1&cursor=' + encodeURIComponent(cursor)))).status, 400);
 assert.equal(r.queries.length, 0);
});
