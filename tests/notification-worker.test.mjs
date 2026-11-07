import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import * as crypto from 'node:crypto';
// Load riêng bằng Node 24 để không phụ thuộc TypeScript compiler API của nhánh khác.
function load(file,mocks,globals={}) {
 let source=stripTypeScriptTypes(readFileSync(new URL(file,import.meta.url),'utf8'));
 const names=[...source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map(m=>m[1]);
 source=source.replace(/import "server-only";/g,'').replace(/import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["'];/g,(_,names,id)=>`const {${names}}=require(${JSON.stringify(id)});`).replace(/\bexport\s+/g,'');
 return new Function('require','process','Buffer',source+`;return {${names.join(',')}};`)(id=>id==='node:crypto'?crypto:mocks[id]??assert.fail(`Unexpected import: ${id}`),globals.process??process,Buffer);
}
const job={id:'delivery-1',userId:'owner',token:'PRIVATE_TOKEN',notificationId:'notice',orderId:'order',title:'New order',body:'Open orders',ttl:45};
test('worker acks only claimed device results, including partial failure',async()=>{
 const calls=[];
 const admin={rpc:async(name,args)=>{calls.push({name,args});return name==='claim_restaurant_notifications'?{data:{busy:false,leaseId:'lease',jobs:[job]},error:null}:{error:null}}};
 const worker=load('../services/notification-worker.service.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin},'./firebase-admin.service':{FirebaseAdminService:{sendClaimedDeliveries:async(jobs)=>{assert.equal(jobs.length,1);return [{id:job.id,outcome:'retry',code:'messaging/server-unavailable'}]}}}});
 const result=await worker.runNotificationWorker();assert.equal(result.retry,1);assert.equal(calls[1].args.p_lease_id,'lease');assert.equal(calls[1].args.p_results.length,1);assert.ok(!JSON.stringify(result).includes('PRIVATE_TOKEN'));
});
test('busy worker never sends or acknowledges another lease',async()=>{
 const worker=load('../services/notification-worker.service.ts',{'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async()=>({data:{busy:true,jobs:[]},error:null})})},'./firebase-admin.service':{FirebaseAdminService:{sendClaimedDeliveries:()=>assert.fail('must not send')}}});
 assert.equal((await worker.runNotificationWorker()).busy,true);
});
test('FCM batch carries seller destination and classifies failures per device',async()=>{
 let payload;
 const sdk=load('../services/firebase-admin.service.ts',{'firebase-admin/app':{getApps:()=>[{name:'student-food-server-push'}]},'firebase-admin/messaging':{getMessaging:()=>({sendEach:async(messages)=>{payload=messages;return {responses:[{success:true},{success:false,error:{code:'messaging/server-unavailable'}},{success:false,error:{code:'messaging/registration-token-not-registered'}}]}}})},'@/lib/supabase/admin':{createAdminClient:()=>assert.fail('no user-wide token lookup')}});
 const results=await sdk.FirebaseAdminService.sendClaimedDeliveries([job,{...job,id:'2'},{...job,id:'3'}]);
 assert.equal(results[0].outcome,'accepted');assert.equal(results[1].outcome,'retry');assert.equal(results[2].outcome,'failed');assert.equal(payload[0].data.destination,'seller_orders');assert.equal(payload[0].data.recipientUserId,'owner');assert.equal(payload[0].webpush.headers.TTL,'45');
});
test('cron endpoint rejects missing/bad secret and masks internal failures',async()=>{
 let runs=0;const env={NOTIFICATION_WORKER_SECRET:'a'.repeat(40)};
 const route=load('../app/api/internal/notifications/dispatch/route.ts',{'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},'@/services/notification-worker.service':{runNotificationWorker:async()=>{runs++;throw Error('PRIVATE_TOKEN')}}},{process:{env}});
 assert.equal((await route.POST(new Request('https://app.test/api/internal/notifications/dispatch',{method:'POST'}))).status,401);
 const response=await route.POST(new Request('https://app.test/api/internal/notifications/dispatch',{method:'POST',headers:{authorization:`Bearer ${env.NOTIFICATION_WORKER_SECRET}`}}));
 assert.equal(response.status,503);assert.equal(runs,1);assert.ok(!(await response.text()).includes('PRIVATE_TOKEN'));
});

test('wake only schedules after verified owner lookup and returns before dispatch',async()=>{
 const callbacks=[],filters=[];let runs=0;
 const query={select(){return query},eq(k,v){filters.push([k,v]);return query},gte(){return query},maybeSingle:async()=>({data:{id:'order'},error:null})};
 const route=load('../app/api/notifications/wake/route.ts',{
  'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)},after:fn=>callbacks.push(fn)},
  '@/lib/http/request-origin':{isSameOrigin:()=>true},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'verified-user'}},error:null})}})},
  '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>query})},
  '@/services/notification-worker.service':{runNotificationWorker:async()=>{runs++}},
 });
 const response=await route.POST(new Request('https://app.test/api/notifications/wake',{method:'POST',headers:{'x-order-id':'11111111-1111-4111-8111-111111111111'}}));
 assert.equal(response.status,202);assert.equal(runs,0);assert.equal(callbacks.length,1);
 assert.ok(filters.some(([k,v])=>k==='student_id'&&v==='verified-user'));
 await callbacks[0]();assert.equal(runs,1);
});
