import { PGlite } from '../node_modules/.cache/notification-sql-tests/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
const buyer='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222',shop='33333333-3333-4333-8333-333333333333',order='44444444-4444-4444-8444-444444444444';
const one=async(s,a=[]) => (await db.query(s,a)).rows[0];
try {
const old=await readFile(new URL('./notification-outbox.sql.test.mjs',import.meta.url),'utf8');
await db.exec(old.split('await db.exec(`')[1].split('`);')[0]);
await db.exec(`ALTER TABLE orders ADD COLUMN student_id uuid;
CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;`);
for(const f of ['202611040001_restaurant_notification_outbox.sql','202611070001_student_order_notifications.sql','202611160001_student_cancel_order.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
await db.query("INSERT INTO users VALUES ($1,'active','student',null),($2,'active','seller',null)",[buyer,owner]);
await db.query("INSERT INTO restaurants VALUES ($1,$2,'active')",[shop,owner]);
await db.query("INSERT INTO user_push_tokens(user_id,token) VALUES ($1,'owner-token'),($2,'buyer-token')",[owner,buyer]);
await db.query("INSERT INTO orders(id,restaurant_id,student_id,order_status) VALUES ($1,$2,$3,'pending')",[order,shop,buyer]);
await assert.rejects(db.query('SELECT cancel_pending_order($1)',[order]),/UNAUTHORIZED/);
await db.query("SELECT set_config('test.uid',$1,false)",[owner]);
await assert.rejects(db.query('SELECT cancel_pending_order($1)',[order]),/ORDER_NOT_FOUND/);
await db.query("SELECT set_config('test.uid',$1,false)",[buyer]);
await db.exec('BEGIN'); await db.query('SELECT cancel_pending_order($1)',[order]); await db.exec('ROLLBACK');
assert.equal((await one('SELECT order_status FROM orders WHERE id=$1',[order])).order_status,'pending');
assert.equal((await one("SELECT count(*)::int n FROM notification_outbox WHERE event_type='order_cancelled'")).n,0);
await db.query("UPDATE orders SET order_status='accepted' WHERE id=$1",[order]);
await assert.rejects(db.query('SELECT cancel_pending_order($1)',[order]),/ORDER_INVALID_STATUS/);
// Reset fixture only; application never resets accepted to pending.
await db.query("UPDATE orders SET order_status='pending' WHERE id=$1",[order]);
await db.query('SELECT cancel_pending_order($1)',[order]); await db.query('SELECT cancel_pending_order($1)',[order]);
assert.equal((await one("SELECT count(*)::int n FROM notification_outbox WHERE event_type='order_cancelled'")).n,1);
const batch=(await one('SELECT claim_restaurant_notifications() b')).b;
const cancelled=batch.jobs.filter(j=>j.title==='Khách đã hủy đơn hàng');
assert.equal(cancelled.length,1); assert.equal(cancelled[0].userId,owner); assert.equal(cancelled[0].destination,'seller_orders');
assert.equal(batch.jobs.filter(j=>j.title==='Có đơn hàng mới').length,0);
await db.exec('SET ROLE anon'); await assert.rejects(db.query('SELECT public.cancel_pending_order($1)',[order]),/permission denied/);
console.log('PASS cancellation: auth, ownership, rollback, prior acceptance conflict, idempotency, owner delivery, obsolete new-order push skipped');
} finally {await db.close();}
