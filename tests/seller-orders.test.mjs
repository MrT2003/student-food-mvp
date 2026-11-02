import assert from "node:assert/strict";
import {test} from "node:test";
import {createClient as createSdkClient} from "@supabase/supabase-js";
import {load,userId,restaurantId,other} from "./seller-sdk-fixture.mjs";
const plain=value=>JSON.parse(JSON.stringify(value));
const oid=n=>`33333333-3333-4333-8333-${String(n).padStart(12,"0")}`;
const contract=load("../lib/seller/order-contract.ts");
const row=(n=1,status="pending",patch={})=>({
 id:oid(n),restaurant_id:restaurantId,order_code:`TEST-${n}`,order_status:status,created_at:"2026-11-02T03:00:00.000Z",payment_method:"cash",subtotal:"21000",total:"26000",delivery_address:"TEST ADDRESS",customer_notes:null,
 customer:{name:"TEST CUSTOMER",phone:"synthetic",app_lock_pin:"PRIVATE"},
 order_items:[{id:oid(100+n),item_name_snapshot:"HISTORICAL ITEM",unit_price_snapshot:"20000",total_price:"21000",quantity:2,image_url:null,selected_options:[{group_name:"OLD GROUP",option_name:"OLD OPTION",additional_price:"1000",pin:"PRIVATE"}]}],
 student_id:other,delivery_token:"PRIVATE",...patch,
});
const canonical=(n=1,status="pending",patch={})=>contract.mapSellerOrder(row(n,status,patch),restaurantId);
function readFixture(options={}) {
 const calls=[],rows=options.rows??[...['pending','accepted','completed','rejected','cancelled'].map((status,i)=>row(i+1,status)),row(9,'pending',{restaurant_id:other})];
 const client={auth:{getUser:async()=>({data:{user:options.noUser?null:{id:options.authId??userId}},error:null})},from(table){
  const call={table,filters:[],fields:null,range:null,sort:[]};calls.push(call);
  const matches=r=>call.filters.every(([key,value])=>key==='restaurant.owner_id'?value===(options.changedOwner?other:userId):key==='restaurant.owner.role'?value===(options.role??'seller'):key==='restaurant.owner.status'?value===(options.status??'active'):r[key]===value);
  return {select(fields){call.fields=fields;return this;},eq(key,value){call.filters.push([key,value]);return this;},order(key,settings){call.sort.push([key,settings]);return this;},range(from,to){call.range=[from,to];return this;},
   async maybeSingle(){
    if(options.queryError===table)return {data:null,error:{code:options.errorCode??'42501',message:'PRIVATE'}};
    if(table==='users')return {data:options.noProfile?null:{role:options.role??'seller',status:options.status??'active'},error:null};
    if(table==='restaurants')return {data:options.notOwner||call.filters.some(([k,v])=>k==='id'&&v!==restaurantId)?null:{id:restaurantId},error:null};
    return {data:rows.find(matches)??null,error:null};
   },
   async then(resolve,reject){try{
    assert.equal(table,'orders');assert.ok(call.range,'list must explicitly bound page before awaiting query');
    if(options.queryError===table)return resolve({data:null,error:{code:options.errorCode??'42501',message:'PRIVATE'}});
    const scoped=rows.filter(matches);const [from,to]=call.range;
    resolve({data:scoped.slice(from,Math.min(to+1,from+(options.pageCap??100))),error:null});
   }catch(error){reject(error);}},
  };
 }};
 const service=load('../services/seller-orders.service.ts',{'@/lib/seller/order-contract':contract});
 const http=load('../lib/seller/orders-http.ts',{'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},'@/lib/supabase/server':{createClient:async()=>client},'@/services/seller-orders.service':service});
 return {...service,client,calls,rows,api:(orderId,rid=restaurantId)=>http.readSellerOrders(Promise.resolve({restaurantId:rid,...(orderId?{orderId}:{})}))};
}
test('list SDK scopes owner/active role inside read, paginates full dataset and strips private fields',async()=>{
 const f=readFixture({pageCap:1});const result=await f.SellerOrderServices.list(f.client,userId,restaurantId);assert.equal(result.orders.length,5);
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.ok(result.orders.every(r=>r.restaurant_id===restaurantId));
 const queries=f.calls.filter(c=>c.table==='orders');assert.equal(queries.length,6);assert.deepEqual(queries[0].filters,[['restaurant_id',restaurantId],['restaurant.owner_id',userId],['restaurant.owner.role','seller'],['restaurant.owner.status','active']]);
 assert.ok(queries[0].fields.includes('selected_options'));assert.ok(queries[0].fields.includes('total_price'));assert.equal(queries[0].fields.includes('*'),false);assert.equal(queries[0].fields.includes('menu_items'),false);
 assert.deepEqual(plain(result.orders.map(r=>r.order_status)),['pending','accepted','completed','rejected','cancelled']);assert.equal(result.orders.find(r=>r.order_status==='completed').customer.phone,null);
});
for(const [options,code,status]of [[{noUser:true},'UNAUTHORIZED',401],[{role:'student'},'ORDER_FORBIDDEN',403],[{role:'staff'},'ORDER_FORBIDDEN',403],[{status:'inactive'},'ORDER_FORBIDDEN',403],[{noProfile:true},'ORDER_FORBIDDEN',403],[{notOwner:true},'RESTAURANT_NOT_FOUND',404],[{queryError:'orders'},'ORDER_FORBIDDEN',403],[{queryError:'orders',errorCode:'42703'},'ORDERS_SCHEMA_MISMATCH',503],[{queryError:'orders',errorCode:'PGRST200'},'ORDERS_SCHEMA_MISMATCH',503],[{queryError:'orders',errorCode:'XX000'},'ORDERS_READ_FAILED',503]])test('list authorization/schema error '+JSON.stringify(options),async()=>{
 const f=readFixture(options);await assert.rejects(f.SellerOrderServices.list(f.client,userId,restaurantId),{message:code});const response=await f.api();assert.equal(response.status,status);assert.equal(JSON.stringify(await response.json()).includes('PRIVATE'),false);
});
test('read detail authorizes same restaurant; no phantom empty list on malformed DB data',async()=>{
 const f=readFixture();assert.equal((await f.api(oid(1))).status,200);assert.equal((await f.api(oid(9))).status,404);assert.equal((await f.api(undefined,other)).status,404);assert.equal((await f.api('bad')).status,400);
 const empty=readFixture({rows:[]});assert.deepEqual(await (await empty.api()).json(),{orders:[]});
 const invalid=readFixture({rows:[row(1,'unexpected')]});assert.equal((await invalid.api()).status,503);
 const changed=readFixture({changedOwner:true});assert.equal((await changed.SellerOrderServices.list(changed.client,userId,restaurantId)).orders.length,0);
});
test('mapper preserves snapshots/authoritative totals and missing values without menu or price reconstruction',()=>{
 const data=canonical();assert.equal(data.total,26000);assert.equal(data.order_items[0].quantity,2);assert.equal(data.order_items[0].unit_price_snapshot,20000);assert.equal(data.order_items[0].total_price,21000);assert.equal(data.order_items[0].item_name_snapshot,'HISTORICAL ITEM');assert.equal(data.order_items[0].selected_options[0].option_name,'OLD OPTION');
 const missing=canonical(1,'pending',{customer:null,total:null,subtotal:null,order_items:[{...row().order_items[0],image_url:'javascript:invalid',selected_options:null,total_price:null,item_name_snapshot:null}]});assert.equal(missing.customer.name,null);assert.equal(missing.total,null);assert.equal(missing.order_items[0].image_url,null);assert.equal(missing.order_items[0].total_price,null);assert.equal(missing.order_items[0].selected_options,null);
});

function approvalFixture(options={}) {
 let status=options.orderStatus??'pending',accepted=null,tail=Promise.resolve(),written=0;const calls=[];
 const client={auth:{getUser:async()=>({data:{user:options.noUser?null:{id:userId}},error:null})},from(table){const call={table,filters:[],fields:''};calls.push(call);return {select(fields){call.fields=fields;return this;},eq(key,value){call.filters.push([key,value]);return this;},update(){throw Error('SDK UPDATE forbidden');},async maybeSingle(){
  if(table==='users')return {data:{role:options.role??'seller',status:options.inactive?'inactive':'active',work_for_restaurant_id:restaurantId},error:null};
  if(table==='restaurants')return {data:options.notOwner?null:{id:restaurantId},error:null};
  if(options.missing||call.filters.some(([k,v])=>k==='id'&&v!==oid(1)))return {data:null,error:null};
  if(written&&options.postReadFails)return {data:null,error:{message:'PRIVATE'}};
  return {data:{id:oid(1),restaurant_id:restaurantId,order_status:status,accepted_at:accepted,private:'PRIVATE'},error:null};
 }};},async rpc(name,payload){calls.push({rpc:name,payload});let unlock;const before=tail;tail=new Promise(resolve=>{unlock=resolve;});await before;try{
  if(options.networkBefore)throw Error('PRIVATE');if(options.rpcError)return {data:null,error:options.rpcError};
  if(options.ownerChanged)return {data:null,error:{code:'P0001',message:'NOT_ALLOWED'}};
  if(status!=='pending')return {data:null,error:{code:'P0001',message:'ORDER_INVALID_STATUS'}};
  status=name==='accept_order'?'accepted':'rejected';accepted=name==='accept_order'?'2026-11-02T03:01:00.000Z':null;written++;
  if(options.networkAfter)throw Error('PRIVATE_AFTER');return {data:options.response??{success:true,order_id:oid(1),order_status:status},error:null};
 }finally{unlock();}}};
 const service=load('../services/order-approval.service.ts');const http=load('../lib/orders/approval-http.ts',{'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},'@/lib/supabase/server':{createClient:async()=>client},'@/services/order-approval.service':service});
 return {...service,client,calls,written:()=>written,status:()=>status,api:(action,body={},origin='http://localhost:3000')=>http.approveOrder(new Request('http://localhost:3000/api/orders/test/'+action,{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}),Promise.resolve({orderId:oid(1)}),action)};
}
for(const action of ['accept','reject'])test('RPC '+action+' uses fixed payload/session and verifies saved row without SDK update',async()=>{
 const f=approvalFixture();const response=await f.api(action);assert.equal(response.status,200);const result=await response.json();assert.equal(result.order.order_status,action==='accept'?'accepted':'rejected');assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.equal(f.calls.find(c=>c.rpc).rpc,action+'_order');assert.deepEqual(plain(f.calls.find(c=>c.rpc).payload),{p_order_id:oid(1)});
 assert.equal(result.order.accepted_at,action==='accept'?'2026-11-02T03:01:00.000Z':null);
 assert.equal((await f.api(action)).status,409);assert.equal(f.written(),1);
});
test('accept/reject concurrent compete at shared locked RPC; one result commits (mock model)',async()=>{
 const f=approvalFixture();const results=await Promise.all([f.api('accept'),f.api('reject')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(f.written(),1);assert.ok(['accepted','rejected'].includes(f.status()));
});
for(const [options,status]of [[{noUser:true},401],[{role:'student'},403],[{role:'staff'},403],[{inactive:true},403],[{notOwner:true},404],[{missing:true},404],[{ownerChanged:true},403],[{orderStatus:'cancelled'},409],[{rpcError:{code:'PGRST202',message:'PRIVATE'}},503],[{rpcError:{code:'42501',message:'PRIVATE'}},403],[{rpcError:{code:'XX000',message:'PRIVATE'}},500]])test('reject permission/RPC error '+JSON.stringify(options),async()=>{
 const f=approvalFixture(options);const response=await f.api('reject');assert.equal(response.status,status);assert.equal(JSON.stringify(await response.json()).includes('PRIVATE'),false);assert.equal(f.written(),0);
});
for(const options of [{networkBefore:true},{networkAfter:true},{response:{success:false}},{response:{success:true,order_id:other,order_status:'accepted'}},{postReadFails:true}])test('unknown approval result never retries/compensates '+JSON.stringify(options),async()=>{
 const f=approvalFixture(options);const response=await f.api('accept');assert.equal(response.status,503);assert.equal((await response.json()).error.code,'ORDER_RESULT_UNKNOWN');assert.equal(f.calls.filter(c=>c.rpc).length,1);
});
test('mutations reject forged body/Origin and do not bypass authorization',async()=>{
 const f=approvalFixture();assert.equal((await f.api('reject',{},'http://evil.invalid')).status,403);assert.equal(f.calls.length,0);
 for(const body of [null,[],{order_status:'rejected'},{restaurantId},{userId}])assert.equal((await f.api('reject',body)).status,400);assert.equal(f.written(),0);
});

const formatting=load('../lib/format.ts');const filters=load('../lib/seller/orders.ts',{'@/lib/format':formatting});
test('Vietnam Today uses UTC+7 day at boundary, counts all five statuses before UI pagination',()=>{
 assert.equal(filters.vietnamDay('2026-11-01T17:00:00Z'),'2026-11-02');assert.equal(filters.vietnamDay('2026-11-01T16:59:59Z'),'2026-11-01');
 const rows=['pending','pending','accepted','completed','rejected','cancelled'].map((s,i)=>canonical(i+1,s,{created_at:'2026-11-01T17:01:00Z'}));
 const filtered=filters.filterSellerOrders(rows,restaurantId,'','2026-11-02');assert.equal(filtered.length,6);assert.equal(filtered.filter(o=>filters.isInSellerTab(o.order_status,'cancelled')).length,2);
 assert.equal(filters.filterSellerOrders(rows,restaurantId,'#TEST-2',null).length,1);assert.equal(filters.filterSellerOrders(rows,other,'',null).length,0);
});

function clientFixture(options={}) {
 let actor=userId;const calls=[];
 const f=load('../lib/seller/orders-client.ts',{
  './order-contract':contract,
  '@/store/useAuthStore':{useAuthStore:{getState:()=>({user:{id:actor,role:'seller',status:'active'}})}},
 },{AbortController,setTimeout:options.setTimeout??setTimeout,clearTimeout:options.clearTimeout??clearTimeout,fetch:async(url,request)=>{
  calls.push({url,request});if(options.fetch)return options.fetch(url,request);
  if(request.method==='POST'){
   if(options.network)throw Error('PRIVATE_NETWORK');
   return Response.json(options.body??{order:{id:oid(1),restaurant_id:restaurantId,order_status:'accepted',accepted_at:'fixed'}},{status:options.http??200});
  }
  return Response.json(url.endsWith('/'+oid(1))?{order:canonical(1,options.after??'accepted')}:{orders:[canonical()]});
 }});
 return {...f,calls,actor:id=>{actor=id;}};
}
test('client actual list maps DTO; action sends UUID/empty body and uses only expected endpoint',async()=>{
 const f=clientFixture();assert.equal((await f.readSellerOrders(userId,restaurantId))[0].order_code,'TEST-1');await f.decideSellerOrder(userId,restaurantId,oid(1),'accept');
 assert.equal(f.calls[1].url,`/api/orders/${oid(1)}/accept`);assert.equal(f.calls[1].request.body,'{}');assert.equal(f.calls[1].request.credentials,'same-origin');
});
for(const option of [{network:true},{body:{}},{http:503,body:{error:{code:'ORDER_RESULT_UNKNOWN',message:'PRIVATE'}}}])test('uncertain mutation reads exact order once and never retries POST '+JSON.stringify(option),async()=>{
 const f=clientFixture(option);assert.equal((await f.decideSellerOrder(userId,restaurantId,oid(1),'accept')).recovered,true);assert.deepEqual(f.calls.map(c=>c.request.method),['POST','GET']);
 const otherState=clientFixture({...option,after:'rejected'});await assert.rejects(otherState.decideSellerOrder(userId,restaurantId,oid(1),'accept'),{code:'ORDER_CONFLICT'});assert.equal(otherState.calls.length,2);
});
for(const [code,status]of [['ORDER_CONFLICT',409],['ORDER_RPC_UNAVAILABLE',503],['ORDER_FORBIDDEN',403]])test('known action error is safe and not rewritten as success '+code,async()=>{
 const f=clientFixture({http:status,body:{error:{code,message:'PRIVATE'}}});await assert.rejects(f.decideSellerOrder(userId,restaurantId,oid(1),'accept'),e=>e.code===code&&!e.message.includes('PRIVATE'));assert.equal(f.calls.length,1);
});
test('client ignores late account response and timeout only reconciles with GET (mock clock)',async()=>{
 let resolve;const f=clientFixture({fetch:()=>new Promise(done=>{resolve=done;})});const pending=f.readSellerOrders(userId,restaurantId);f.actor(other);resolve(Response.json({orders:[canonical()]}));await assert.rejects(pending,{code:'ACCOUNT_CHANGED'});
 let fire,cleared=0;const timed=clientFixture({setTimeout(fn,ms){assert.equal(ms,15000);fire=fn;return 1;},clearTimeout(){cleared++;},fetch:async(url,request)=>request.method==='POST'?new Promise((_,reject)=>request.signal.addEventListener('abort',()=>reject(Error('synthetic')))):Response.json({order:canonical(1,'pending')})});
 const result=timed.decideSellerOrder(userId,restaurantId,oid(1),'accept');fire();await assert.rejects(result,{code:'ORDER_RESULT_UNKNOWN'});assert.deepEqual(timed.calls.map(c=>c.request.method),['POST','GET']);assert.equal(cleared,2);
});

test('client preserves HTTP auth denial even with unknown error code and forwards cancellation safely',async()=>{
 for(const status of [401,403]){
  const f=clientFixture({fetch:async()=>Response.json({error:{code:'UNRECOGNIZED',message:'PRIVATE'}},{status})});
  await assert.rejects(f.readSellerOrders(userId,restaurantId),e=>f.isOrderAccessDenied(e)&&!e.message.includes('PRIVATE'));
 }
 const abort=new AbortController();let signal;
 const f=clientFixture({fetch:async(_,request)=>{signal=request.signal;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));}});
 const result=f.readSellerOrders(userId,restaurantId,abort.signal);abort.abort();await assert.rejects(result);assert.equal(signal.aborted,true);
});

const jsx=(type,props,key)=>({type,props,key});
function harness(file,mocks={},globals={}) {
 let sc=0,rc=0,ec=0,mc=0;const states=[],refs=[],effects=[],memos=[];
 const changed=(a,b)=>!a||a.length!==b?.length||a.some((value,i)=>value!==b[i]);
 const react={useState(initial){const i=sc++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useRef(initial){const i=rc++;return refs[i]??(refs[i]={current:initial});},useCallback(fn,deps){const i=mc++;if(changed(memos[i]?.deps,deps))memos[i]={fn,deps};return memos[i].fn;},useEffect(fn,deps){const i=ec++;if(changed(effects[i]?.deps,deps))effects[i]={...effects[i],fn,deps,pending:true};}};
 const exported=load(file,{react,'react/jsx-runtime':{jsx,jsxs:jsx},...mocks},{Error,...globals});
 return {render(name,...args){sc=rc=ec=mc=0;return exported[name](...args);},flush(){for(const effect of effects)if(effect.pending){effect.cleanup?.();effect.pending=false;effect.cleanup=effect.fn();}},unmount(){effects.forEach(e=>e.cleanup?.());}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fakeClock(){
 let now=0,id=0;const timers=new Map();
 return {timers,setTimeout(fn,ms){const key=++id;timers.set(key,{fn,at:now+ms});return key;},clearTimeout(key){timers.delete(key);},async advance(ms){const end=now+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await tick();}now=end;},delay(){return [...timers.values()][0]?.at-now;}};
}
const denied=error=>[401,403].includes(error?.status)||['UNAUTHORIZED','ORDER_FORBIDDEN','ACCOUNT_CHANGED','RESTAURANT_NOT_FOUND'].includes(error?.code);
function ordersHook(options={}){
 let actor=userId,rows=[canonical()],mutations=0;const events=new Map(),docEvents=new Map(),clock=fakeClock();
 const doc={visibilityState:'visible',addEventListener:(name,fn)=>docEvents.set(name,fn),removeEventListener:name=>docEvents.delete(name)};
 const nav={onLine:true},requests=[];
 const refresh=load('../lib/seller/orders-refresh.ts',{}, {...clock,AbortController});
 const ui=harness('../lib/seller/useSellerOrders.ts',{'./orders-refresh':refresh,'@/store/useAuthStore':{useAuthStore:{getState:()=>({user:{id:actor}})}},'./orders-client':{
  isOrderAccessDenied:denied,
  readSellerOrders:async(a,r,signal)=>{requests.push({a,r,signal});if(options.read)return options.read(signal);return rows;},
  decideSellerOrder:async(a,r,id,action)=>{mutations++;if(options.decide)return options.decide(id,action);rows=[canonical(1,'accepted')];return {recovered:false};},
 }},{document:doc,navigator:nav,window:{addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)}});
 return {...ui,clock,events,docEvents,doc,nav,requests,view:(id=userId,rid=restaurantId)=>ui.render('useSellerOrders',id,rid),actor:id=>{actor=id;},mutations:()=>mutations,rows:value=>{rows=value;}};
}
test('actual hook locks both actions per order, reloads authoritative rows/count source and handles failure',async()=>{
 let done;const f=ordersHook({decide:()=>new Promise(resolve=>{done=resolve;})});f.view();f.flush();await tick();const first=f.view().decide(oid(1),'accept');await f.view().decide(oid(1),'reject');assert.equal(f.mutations(),1);assert.equal(f.view().busyIds.includes(oid(1)),true);
 f.rows([canonical(1,'accepted')]);done({recovered:false});await first;assert.equal(f.view().orders[0].order_status,'accepted');assert.equal(f.view().busyIds.length,0);assert.ok(f.view().notice);f.unmount();
 const bad=ordersHook({decide:async()=>{throw Error('Backend từ chối');}});bad.view();bad.flush();await tick();await bad.view().decide(oid(1),'reject');assert.equal(bad.view().notice,'');assert.equal(bad.view().actionError,'Backend từ chối');assert.equal(bad.view().orders[0].order_status,'pending');bad.unmount();
});
test('hook read error is not empty success and ignores late data after account change/unmount',async()=>{
 const bad=ordersHook({read:async()=>{throw Error('Read failed');}});bad.view();bad.flush();await tick();assert.equal(bad.view().orders,null);assert.ok(bad.view().error);bad.unmount();
 let done;const f=ordersHook({read:()=>new Promise(resolve=>{done=resolve;})});f.view();f.flush();await tick();f.actor(other);f.unmount();done([canonical()]);await tick();assert.equal(f.view().orders,null);
});

test('polling keeps initial empty success during background refresh, discovers and deduplicates new UUIDs',async()=>{
 const pending=[];const f=ordersHook({read:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))});
 assert.equal(f.view().loading,true);f.flush();await tick();pending[0].resolve([]);await tick();assert.equal(f.view().loading,false);assert.deepEqual(plain(f.view().orders),[]);
 await f.clock.advance(9999);assert.equal(pending.length,1);await f.clock.advance(1);
 assert.equal(f.view().loading,false);assert.equal(f.view().isRefreshing,true);assert.deepEqual(plain(f.view().orders),[]);
 pending[1].resolve([canonical(1),canonical(2),canonical(2)]);await tick();assert.deepEqual(plain(f.view().orders.map(o=>o.id)),[oid(1),oid(2)]);assert.equal(f.clock.timers.size,1);f.unmount();assert.equal(f.clock.timers.size,0);
});

test('focus coalesces in-flight GET; slow requests cannot overlap even across many polling intervals',async()=>{
 const pending=[];const f=ordersHook({read:signal=>new Promise(resolve=>pending.push({resolve,signal}))});f.view();f.flush();await tick();
 f.events.get('focus')();f.events.get('focus')();await f.clock.advance(60000);assert.equal(pending.length,1);assert.equal(f.clock.timers.size,0);
 pending[0].resolve([canonical()]);await tick();await f.clock.advance(10000);assert.equal(pending.length,2);
 f.events.get('focus')();assert.equal(f.view().orders[0].id,oid(1));assert.equal(f.view().loading,false);await f.clock.advance(60000);assert.equal(pending.length,2);
 f.unmount();assert.equal(pending[1].signal.aborted,true);assert.equal(f.events.size,0);assert.equal(f.docEvents.size,0);pending[1].resolve([canonical(2)]);await tick();assert.equal(f.view().orders[0].id,oid(1));
});

test('hidden/offline pauses timers and aborts old reads; resume/reconnect refreshes immediately',async()=>{
 const f=ordersHook();f.view();f.flush();await tick();assert.equal(f.requests.length,1);
 f.doc.visibilityState='hidden';f.docEvents.get('visibilitychange')();assert.equal(f.clock.timers.size,0);await f.clock.advance(30000);assert.equal(f.requests.length,1);
 f.doc.visibilityState='visible';f.docEvents.get('visibilitychange')();f.events.get('focus')();await tick();assert.equal(f.requests.length,2);assert.equal(f.view().loading,false);
 f.nav.onLine=false;f.events.get('offline')();await f.clock.advance(30000);assert.equal(f.requests.length,2);
 f.nav.onLine=true;f.events.get('online')();await tick();assert.equal(f.requests.length,3);assert.equal(f.clock.timers.size,1);f.unmount();
});

test('paused request ignores abort: queue resume once and discard its late response',async()=>{
 let done;const slow=ordersHook({read:()=>new Promise(resolve=>{done=resolve;})});slow.view();slow.flush();await tick();
 slow.doc.visibilityState='hidden';slow.docEvents.get('visibilitychange')();assert.equal(slow.requests[0].signal.aborted,true);
 slow.doc.visibilityState='visible';slow.docEvents.get('visibilitychange')();slow.events.get('focus')();await tick();assert.equal(slow.requests.length,1);
 const old=done;old([canonical(9)]);await tick();assert.equal(slow.requests.length,2);assert.equal(slow.view().orders,null);done([canonical(2)]);await tick();assert.equal(slow.view().orders[0].id,oid(2));slow.unmount();
});

test('network/server refresh failures retain rows, use bounded backoff and reset after recovery',async()=>{
 let failing=false;const f=ordersHook({read:async()=>{if(failing)throw Error('PRIVATE');return [canonical()];}});f.view();f.flush();await tick();failing=true;
 for(const [wait,next]of [[10000,10000],[10000,20000],[20000,40000],[40000,60000],[60000,60000]]){
  await f.clock.advance(wait);const v=f.view();assert.equal(v.orders.length,1);assert.equal(v.loading,false);assert.equal(v.error,'');assert.ok(v.refreshError);assert.equal(v.refreshError.includes('PRIVATE'),false);assert.equal(f.clock.delay(),next);
 }
 failing=false;await f.clock.advance(60000);assert.equal(f.view().refreshError,'');assert.equal(f.clock.delay(),10000);f.unmount();
});
for(const status of [401,403])test('confirmed '+status+' clears data and stops auto refresh, including focus/reconnect',async()=>{
 let failure=false;const f=ordersHook({read:async()=>{if(failure)throw {status};return [canonical()];}});f.view();f.flush();await tick();failure=true;await f.clock.advance(10000);
 assert.equal(f.view().orders,null);assert.equal(f.view().blocked,true);assert.equal(f.clock.timers.size,0);const count=f.requests.length;
 f.events.get('focus')();f.nav.onLine=false;f.events.get('offline')();f.nav.onLine=true;f.events.get('online')();await f.clock.advance(60000);assert.equal(f.requests.length,count);
 failure=false;await f.view().reload();assert.equal(f.view().orders.length,1);f.unmount();
});

test('pre-mutation GET cannot restore pending; exactly one queued post-mutation read survives coalescing',async()=>{
 const pending=[];let write;const f=ordersHook({read:()=>new Promise(resolve=>pending.push(resolve)),decide:()=>new Promise(resolve=>{write=resolve;})});f.view();f.flush();await tick();pending[0]([canonical()]);await tick();
 await f.clock.advance(10000);const mutation=f.view().decide(oid(1),'accept');assert.equal(f.requests[1].signal.aborted,true);
 write({recovered:false});await tick();f.events.get('focus')();assert.equal(pending.length,2);
 pending[1]([canonical(1,'pending'),canonical(9)]);await tick();assert.equal(pending.length,3);assert.equal(f.view().orders.length,1);assert.ok(f.view().busyIds.includes(oid(1)));
 pending[2]([canonical(1,'accepted')]);await mutation;assert.equal(f.view().orders[0].order_status,'accepted');assert.equal(f.mutations(),1);assert.equal(f.clock.timers.size,1);f.unmount();
});

test('acknowledged mutation stays successful when reconciliation fails, then polling recovers',async()=>{
 let fail=false,status='pending';const f=ordersHook({read:async()=>{if(fail)throw Error('PRIVATE');return [canonical(1,status)];},decide:async()=>{fail=true;status='rejected';return {recovered:false};}});f.view();f.flush();await tick();await f.view().decide(oid(1),'reject');
 assert.ok(f.view().notice.includes('Backend đã xác nhận'));assert.equal(f.view().actionError,'');assert.ok(f.view().refreshError);assert.equal(f.view().orders[0].order_status,'pending');assert.equal(f.mutations(),1);
 fail=false;await f.clock.advance(10000);assert.equal(f.view().orders[0].order_status,'rejected');assert.equal(f.view().refreshError,'');f.unmount();
});

test('different orders can mutate concurrently; both stay busy through one shared reconciliation',async()=>{
 const writes=new Map(),f=ordersHook({decide:id=>new Promise(resolve=>writes.set(id,resolve))});f.rows([canonical(1),canonical(2)]);f.view();f.flush();await tick();
 const a=f.view().decide(oid(1),'accept'),b=f.view().decide(oid(2),'reject');writes.get(oid(1))({recovered:false});await tick();
 assert.equal(f.view().busyIds.length,2);assert.equal(f.requests.length,1);f.rows([canonical(1,'accepted'),canonical(2,'rejected')]);writes.get(oid(2))({recovered:false});await Promise.all([a,b]);
 assert.equal(f.requests.length,2);assert.equal(f.view().busyIds.length,0);assert.deepEqual(plain(f.view().orders.map(o=>o.order_status)),['accepted','rejected']);f.unmount();
});

test('switching account/shop masks old data immediately and cancels old polling controller',async()=>{
 const f=ordersHook();f.view();f.flush();await tick();assert.equal(f.view().orders.length,1);
 assert.equal(f.view(userId,other).orders,null);f.flush();await tick();assert.equal(f.requests.at(-1).r,other);assert.equal(f.clock.timers.size,1);
 f.actor(other);assert.equal(f.view().orders,null);f.unmount();assert.equal(f.clock.timers.size,0);
});

function nodes(node){if(!node||typeof node!=='object')return [];const children=typeof node.type==='function'?node.type(node.props):node.props?.children;return [node,...[children].flat(Infinity).flatMap(nodes)];}
function text(node){if(node==null||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);if(Array.isArray(node))return node.map(text).join('');return text(typeof node.type==='function'?node.type(node.props):node.props?.children);}
function viewFixture(options={}) {
 let actor=userId;const calls=[];const data={orders:options.rows??['pending','pending','pending','pending','accepted','completed','rejected','cancelled'].map((status,i)=>canonical(i+1,status)),loading:!!options.loading,error:options.error??'',notice:'',actionError:'',busyIds:options.busy??[],reload:async()=>calls.push('reload'),decide:(id,action)=>calls.push({id,action}),clearNotice(){}};
 const restaurant={id:restaurantId,name:'REAL TEST SHOP',slug:'real',status:'active',operating_status:'open',avatar_url:null,operating_hours:null,description:null,location:null};
 class Clock extends Date {constructor(value='2026-11-02T03:00:00Z'){super(value);}static now(){return Date.parse('2026-11-02T03:00:00Z');}}
 const ui=harness('../components/features/seller/SellerOrdersView.tsx',{'next/image':{default:'img'},'lucide-react':{},'@/components/layout/StudentHeader':{default:'header'},'./SellerSidebar':{default:'sidebar'},'./SellerAccessProvider':{useSellerAccess:()=>({data:{user:{id:actor},restaurant}})},'@/lib/seller/useSellerOrders':{useSellerOrders:()=>data},'@/components/ui/FoodThumbnail':{default:'placeholder'},'@/lib/seller/orders':filters,'@/lib/format':formatting,'@/lib/orders/order-mappers':{formatOrderDate:value=>filters.vietnamDay(value),formatOrderPayment:value=>value==='cash'?'Tiền mặt':value==='bank_transfer'?'Chuyển khoản':'Chưa có phương thức thanh toán'},'@/lib/orders/order-detail':{orderStatusLabels:{pending:'Chờ xác nhận',accepted:'Đã chấp nhận',completed:'Hoàn thành',rejected:'Bị từ chối',cancelled:'Đã hủy'}},'@/styles/seller-orders.module.css':{default:{}}},{Date:Clock,window:{confirm:()=>true,setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false})}});
 return {...ui,calls,data,root:()=>ui.render('default'),view:()=>ui.render('SellerOrdersContent',{actorId:userId,restaurant}),actor:id=>{actor=id;}};
}
test('actual view displays real snapshots, correct full tab counts/page and distinct rejected/cancelled labels',async()=>{
 const f=viewFixture();f.view();f.flush();await tick();let tree=f.view();assert.ok(text(tree).includes('Chờ xác nhận (4)'));assert.ok(text(tree).includes('Đã hủy / từ chối (2)'));assert.ok(text(tree).includes('4 đơn · Trang 1/2'));assert.equal(nodes(tree).filter(n=>n.type==='article').length,3);
 const tabs=nodes(tree).filter(n=>n.type==='button'&&n.props['aria-pressed']!==undefined);tabs.find(n=>n.key==='cancelled').props.onClick();tree=f.view();assert.ok(text(tree).includes('Bị từ chối'));assert.ok(text(tree).includes('Đã hủy'));assert.equal(text(tree).includes('Bản demo UI'),false);f.unmount();
});
test('actual view calls API helper with UUID, disables both busy buttons and completion does not fake save',async()=>{
 const f=viewFixture();f.view();f.flush();await tick();let tree=f.view();nodes(tree).find(n=>n.type==='button'&&text(n)==='Chấp nhận').props.onClick();assert.deepEqual(f.calls[0],{id:oid(1),action:'accept'});
 f.data.busyIds=[oid(1)];tree=f.view();const card=nodes(tree).find(n=>n.type==='article');assert.ok(nodes(card).filter(n=>n.type==='button'&&['Chấp nhận','Từ chối'].includes(text(n))).every(n=>n.props.disabled));
 nodes(tree).find(n=>n.key==='accepted'&&n.type==='button').props.onClick();tree=f.view();assert.equal(nodes(tree).find(n=>n.type==='button'&&text(n)==='Hoàn thành').props.disabled,true);assert.equal(f.data.orders.find(o=>o.id===oid(5)).order_status,'accepted');f.unmount();
});
test('view read error has retry instead of empty/mock; detail uses snapshot amount without inferred fee',async()=>{
 const bad=viewFixture({error:'Could not load',rows:null});bad.view();bad.flush();await tick();const errorTree=bad.view();assert.ok(nodes(errorTree).some(n=>n.props?.role==='alert'));assert.equal(text(errorTree).includes('Không có đơn hàng'),false);nodes(errorTree).find(n=>n.type==='button'&&text(n)==='Thử lại').props.onClick();assert.deepEqual(bad.calls,['reload']);bad.unmount();
 const f=viewFixture();f.view();f.flush();await tick();nodes(f.view()).find(n=>n.type==='button'&&n.props['aria-label']==='Xem đơn TEST-1').props.onClick({currentTarget:{focus(){}}});const tree=f.view();assert.ok(text(tree).includes('HISTORICAL ITEM'));assert.ok(text(tree).includes('OLD OPTION'));assert.ok(text(tree).includes('26.000'));assert.equal(text(tree).includes('Phí giao hàng'),false);f.unmount();
});
test('view retains search, Today/all and actor key isolation',async()=>{
 const f=viewFixture({rows:[canonical(1,'pending',{created_at:'2026-11-01T16:59:59Z'}),canonical(2,'pending',{created_at:'2026-11-01T17:00:00Z'})]});f.view();f.flush();await tick();let tree=f.view();assert.ok(text(tree).includes('Chờ xác nhận (1)'));
 nodes(tree).find(n=>n.type==='select'&&n.props['aria-label']==='Thời gian đặt hàng').props.onChange({target:{value:'all'}});tree=f.view();assert.ok(text(tree).includes('Chờ xác nhận (2)'));
 nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'#TEST-1'}});assert.ok(text(f.view()).includes('Chờ xác nhận (1)'));assert.equal(f.root().key,`${userId}:${restaurantId}`);f.actor(other);assert.equal(f.root().key,`${other}:${restaurantId}`);f.unmount();
});

test('background data replacement preserves tab, search, date, sort and open bill/count without loading screen',async()=>{
 const f=viewFixture();f.view();f.flush();await tick();let tree=f.view();
 nodes(tree).find(n=>n.type==='select'&&n.props['aria-label']==='Thời gian đặt hàng').props.onChange({target:{value:'all'}});
 nodes(f.view()).find(n=>n.key==='accepted'&&n.type==='button').props.onClick();
 nodes(f.view()).find(n=>n.type==='input').props.onChange({target:{value:'TEST-5'}});
 tree=f.view();const sort=nodes(tree).find(n=>n.type==='select'&&n.props['aria-label']!=='Thời gian đặt hàng');assert.ok(sort);sort.props.onChange({target:{value:'oldest'}});
 nodes(f.view()).find(n=>n.type==='button'&&n.props['aria-label']==='Xem đơn TEST-5').props.onClick({currentTarget:{focus(){}}});
 f.data.isRefreshing=true;tree=f.view();assert.equal(text(tree).includes('Tải lại đơn hàng'),false);assert.equal(text(tree).includes('Đang tải đơn hàng…'),false);assert.ok(text(tree).includes('Đã chấp nhận (1)'));assert.ok(text(tree).includes('OLD OPTION'));
 f.data.orders=[...f.data.orders.map(o=>({...o})),canonical(10)];f.data.isRefreshing=false;f.data.refreshError='Chưa cập nhật được';tree=f.view();
 assert.equal(nodes(tree).find(n=>n.type==='input').props.value,'TEST-5');assert.equal(nodes(tree).find(n=>n.type==='select'&&n.props['aria-label']==='Thời gian đặt hàng').props.value,'all');assert.equal(nodes(tree).find(n=>n.type==='select'&&n.props['aria-label']!=='Thời gian đặt hàng').props.value,'oldest');
 assert.equal(nodes(tree).find(n=>n.key==='accepted'&&n.type==='button').props['aria-pressed'],true);assert.ok(text(tree).includes('OLD OPTION'));assert.ok(text(tree).includes('Đã chấp nhận (1)'));assert.ok(text(tree).includes('Chưa cập nhật được'));f.unmount();
});

test('real Supabase query builder preserves nested owner/role filters and bounded pages (fetch mock)',async()=>{
 const seen=[];const client=createSdkClient('https://synthetic.invalid','synthetic-anon-key',{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input)=>{
   const url=new URL(typeof input==='string'?input:input.url);seen.push(url);
   const table=url.pathname.split('/').at(-1);
   const data=table==='users'?[{role:'seller',status:'active'}]:table==='restaurants'?[{id:restaurantId}]:url.searchParams.get('offset')==='0'?[row()]:[];
   return Response.json(data);
  }},
 });
 client.auth.getUser=async()=>({data:{user:{id:userId}},error:null});
 const {SellerOrderServices}=load('../services/seller-orders.service.ts',{'@/lib/seller/order-contract':contract});
 const data=await SellerOrderServices.list(client,userId,restaurantId);assert.equal(data.orders.length,1);
 const query=seen.find(url=>url.pathname.endsWith('/orders'));assert.equal(query.searchParams.get('restaurant_id'),'eq.'+restaurantId);assert.equal(query.searchParams.get('restaurant.owner_id'),'eq.'+userId);assert.equal(query.searchParams.get('restaurant.owner.role'),'eq.seller');assert.equal(query.searchParams.get('restaurant.owner.status'),'eq.active');assert.equal(query.searchParams.get('limit'),'100');assert.ok(query.searchParams.get('select').includes('restaurants!orders_restaurant_id_fkey!inner'));
});
