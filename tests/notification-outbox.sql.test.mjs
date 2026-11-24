// PostgreSQL thật chạy trong WASM, fixture độc lập; không đọc env hoặc kết nối Supabase.
// Cài runtime test theo docs/restaurant-notifications.md trước khi chạy.
import { PGlite } from '../node_modules/.cache/notification-sql-tests/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
const owner='11111111-1111-4111-8111-111111111111', staff='22222222-2222-4222-8222-222222222222';
const inactive='33333333-3333-4333-8333-333333333333', restaurant='44444444-4444-4444-8444-444444444444';
const order='55555555-5555-4555-8555-555555555555';
const one=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE public.users(id uuid PRIMARY KEY, status text,role text,work_for_restaurant_id uuid);
 CREATE TABLE public.restaurants(id uuid PRIMARY KEY,owner_id uuid,status text);
 CREATE TABLE public.orders(id uuid PRIMARY KEY,restaurant_id uuid,order_status text);
 CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES public.users(id),type varchar,related_order_id uuid REFERENCES public.orders(id),title varchar,content text,is_read boolean DEFAULT false,created_at timestamptz DEFAULT now());
 CREATE TABLE public.user_push_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES public.users(id),token text UNIQUE,updated_at timestamptz DEFAULT now());`);
 await db.exec(await readFile(new URL('../supabase/migrations/202611040001_restaurant_notification_outbox.sql',import.meta.url),'utf8'));
 await db.query('INSERT INTO users VALUES ($1,\'active\',\'seller\',null),($2,\'active\',\'staff\',$4),($3,\'inactive\',\'staff\',$4)',[owner,staff,inactive,restaurant]);
 await db.query('INSERT INTO restaurants VALUES ($1,$2,\'active\')',[restaurant,owner]);
 await db.query('INSERT INTO user_push_tokens(user_id,token) VALUES ($1,\'owner-1\'),($1,\'owner-2\'),($2,\'staff-1\'),($3,\'inactive\')',[owner,staff,inactive]);
 await db.exec('BEGIN');
 await db.query('INSERT INTO orders VALUES ($1,$2,\'pending\')',[order,restaurant]);
 assert.equal((await one('SELECT count(*)::int n FROM notification_outbox')).n,1);
 await db.exec('ROLLBACK');
 assert.equal((await one('SELECT count(*)::int n FROM notification_outbox')).n,0);
 await db.query('INSERT INTO orders VALUES ($1,$2,\'pending\')',[order,restaurant]);
 const batch=(await one('SELECT claim_restaurant_notifications() b')).b;
 assert.equal(batch.jobs.length,3);
 assert.equal((await one('SELECT count(*)::int n FROM notifications')).n,2);
 assert.equal((await one('SELECT claim_restaurant_notifications() b')).b.busy,true);
 const retry=batch.jobs[0], dead=batch.jobs[1], success=batch.jobs[2];
 await db.query('SELECT finish_restaurant_notifications($1,$2)',[batch.leaseId,JSON.stringify([
  {id:retry.id,outcome:'retry',code:'messaging/server-unavailable'},
  {id:dead.id,outcome:'failed',code:'messaging/registration-token-not-registered'},
  {id:success.id,outcome:'accepted',code:'FCM_ACCEPTED'}])]);
 assert.equal((await one('SELECT count(*)::int n FROM user_push_tokens')).n,3);
 assert.equal((await one('SELECT attempts,status FROM notification_deliveries WHERE id=$1',[retry.id])).status,'pending');
 await db.exec("UPDATE notification_worker_slot SET next_run_at=now(); UPDATE notification_deliveries SET next_attempt_at=now() WHERE status='pending';");
 const next=(await one('SELECT claim_restaurant_notifications() b')).b;
 assert.deepEqual(next.jobs.map(j=>j.id),[retry.id]);
 assert.equal((await one('SELECT count(*)::int n FROM notifications')).n,2);
 await assert.rejects(db.query('SELECT finish_restaurant_notifications($1,$2)',[batch.leaseId,'[]']),/NOTIFICATION_LEASE_LOST/);
 await db.exec("UPDATE notification_worker_slot SET locked_until=now()-interval '1 second',next_run_at=now(); UPDATE notification_deliveries SET locked_until=now()-interval '1 second' WHERE status='processing';");
 const recovered=(await one('SELECT claim_restaurant_notifications() b')).b;
 assert.equal(recovered.jobs.length,1);
 await db.query('SELECT finish_restaurant_notifications($1,$2)',[recovered.leaseId,JSON.stringify([{id:retry.id,outcome:'retry',code:'TEMP'}])]);
 await db.exec("UPDATE notification_worker_slot SET next_run_at=now(); UPDATE notification_deliveries SET next_attempt_at=now() WHERE status='pending';");
 const last=(await one('SELECT claim_restaurant_notifications() b')).b;
 await db.query('SELECT finish_restaurant_notifications($1,$2)',[last.leaseId,JSON.stringify([{id:retry.id,outcome:'retry',code:'TEMP'}])]);
 assert.equal((await one('SELECT attempts,status FROM notification_deliveries WHERE id=$1',[retry.id])).attempts,4);
 assert.equal((await one('SELECT status FROM notification_deliveries WHERE id=$1',[retry.id])).status,'failed');
 await db.exec('SET ROLE anon');
 await assert.rejects(db.query('SELECT claim_restaurant_notifications()'),/permission denied/);
 await db.exec('RESET ROLE');
 console.log('PASS: rollback, recipients, token fanout, busy lease, selective retry, dead token cleanup, fencing, crash recovery, 4-attempt cap, RPC permissions');
} finally { await db.close(); }
