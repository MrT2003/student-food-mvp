import { PGlite } from '../node_modules/.cache/notification-sql-tests/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try {
const old=await readFile(new URL('./notification-outbox.sql.test.mjs',import.meta.url),'utf8');
const schema=old.split('await db.exec(`')[1].split('`);')[0];
await db.exec(schema);
await db.exec('ALTER TABLE orders ADD COLUMN student_id uuid;');
for(const f of ['202611040001_restaurant_notification_outbox.sql','202611070001_student_order_notifications.sql'])
 await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
await db.exec(`INSERT INTO users VALUES ('11111111-1111-4111-8111-111111111111','active','student',null);
INSERT INTO restaurants VALUES ('22222222-2222-4222-8222-222222222222',null,'inactive');
INSERT INTO user_push_tokens(user_id,token) VALUES ('11111111-1111-4111-8111-111111111111','student-token');`);
for(const status of ['accepted','rejected']) {
const id=status==='accepted'?'33333333-3333-4333-8333-333333333333':'44444444-4444-4444-8444-444444444444';
await db.query("INSERT INTO orders VALUES ($1,'22222222-2222-4222-8222-222222222222','pending','11111111-1111-4111-8111-111111111111')",[id]);
await db.exec('BEGIN');
await db.query('UPDATE orders SET order_status=$1 WHERE id=$2',[status,id]);
await db.exec('ROLLBACK');
assert.equal((await db.query("SELECT count(*)::int n FROM notification_outbox WHERE event_type<>'restaurant_order_created' AND order_id=$1",[id])).rows[0].n,0);
await db.query('UPDATE orders SET order_status=$1 WHERE id=$2',[status,id]);
await db.query('UPDATE orders SET order_status=$1 WHERE id=$2',[status,id]);
await db.exec('UPDATE notification_worker_slot SET next_run_at=now()');
const b=(await db.query('SELECT claim_restaurant_notifications() b')).rows[0].b;
assert.equal(b.jobs.length,1);
assert.equal(b.jobs[0].destination,'student_order');
assert.equal(b.jobs[0].orderId,id);
assert.equal(b.jobs[0].userId,'11111111-1111-4111-8111-111111111111');
await db.query('SELECT finish_restaurant_notifications($1,$2)',[b.leaseId,JSON.stringify([{id:b.jobs[0].id,outcome:'accepted',code:'FCM_ACCEPTED'}])]);
}
console.log('PASS: accept/reject, rollback, duplicate update, recipient and student destination, inactive restaurant');
} finally { await db.close(); }
