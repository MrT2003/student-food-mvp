import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, load, userId, restaurantId, other, assertSafe } from "./seller-sdk-fixture.mjs";
const input={operating_status:"open"};
function setup(options={}) {
 const f=fixture(options);f.state.restaurant.operating_status=options.operatingStatus??"closed";
 const route=load("../app/api/seller/restaurants/[restaurantId]/open/route.ts",{
  "next/server":{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  "@/lib/supabase/server":{createClient:async()=>f.client},"@/services/seller.service":f,
 });
 return {...f,open:(body=input,id=restaurantId)=>f.SellerServices.openRestaurant(userId,id,body,f.client),
  async api(body=input,config={}) {
   const headers={"Content-Type":"application/json"};if(config.origin!==null)headers.Origin=config.origin??"http://localhost:3000";
   const request=new Request("http://localhost:3000/api/seller/restaurants/"+restaurantId+"/open",{method:"POST",headers,body:config.raw??JSON.stringify(body)});
   return route.POST(request,{params:Promise.resolve({restaurantId:config.id??restaurantId})});
  }};
}

test("open uses same verified session RPC, fixed params, explicit response and preserves unrelated data",async()=>{
 const f=setup();const before=structuredClone(f.state);const result=await f.open();
 assert.equal(result.restaurant.id,restaurantId);assert.equal(result.restaurant.operating_status,"open");assert.equal(result.alreadyOpen,false);assertSafe(result);
 assert.deepEqual(JSON.parse(JSON.stringify(f.rpcCalls())),[{kind:"rpc",name:"set_restaurant_operating_status",payload:{p_restaurant_id:restaurantId,p_operating_status:"open"}}]);
 assert.equal(f.writes().length,0);assert.equal(f.profileRole(),"seller");assert.equal(f.state.restaurant.operating_status,"open");
 const {operating_status,updated_at,...after}=f.state.restaurant;const {operating_status:old,updated_at:oldTime,...original}=before.restaurant;
 assert.equal(operating_status,"open");assert.deepEqual(after,original);assert.deepEqual(f.state.banks,before.banks);assert.ok(updated_at);assert.equal(old,"closed");assert.equal(oldTime,undefined);
});
test("already-open request is a no-op including updated_at; paused is outside this action",async()=>{
 const f=setup({operatingStatus:"open"});const before=structuredClone(f.state);const result=await f.open();assert.equal(result.alreadyOpen,true);assert.equal(f.rpcCalls().length,0);assert.deepEqual(f.state,before);
 const paused=setup({operatingStatus:"paused"});await assert.rejects(paused.open(),/OPERATING_STATUS_CONFLICT/);assert.equal(paused.rpcCalls().length,0);
 const once=setup();await once.open();const committed=structuredClone(once.state);await once.open();assert.equal(once.rpcCalls().length,1);assert.deepEqual(once.state,committed);
});
for(const [options,code,status] of [[{noUser:true},"UNAUTHORIZED",401],[{status:"inactive"},"ACCOUNT_INACTIVE",403],[{noProfile:true},"PROFILE_NOT_FOUND",403],[{role:"student"},"SELLER_REQUIRED",403],[{role:"staff"},"SELLER_REQUIRED",403],[{notOwner:true},"RESTAURANT_NOT_FOUND",404],[{noRestaurant:true},"RESTAURANT_NOT_FOUND",404],[{errorAt:"owner"},"DATABASE_ACCESS_DENIED",403]])test("open permission "+JSON.stringify(options),async()=>{
 const f=setup(options);const before=structuredClone(f.state);await assert.rejects(f.open(),{message:code});const response=await f.api();assert.equal(response.status,status);assertSafe(await response.json());assert.equal(f.rpcCalls().length,0);assert.deepEqual(f.state,before);
});
test("service rejects actor argument different from Auth, API always uses Auth actor",async()=>{
 const f=setup({authUserId:other});await assert.rejects(f.open(),/UNAUTHORIZED/);assert.equal((await f.api()).status,404);assert.equal(f.rpcCalls().length,0);
});
for(const body of [null,[],{},"open",{operating_status:"paused"},{operating_status:null},{operating_status:" open "},{...input,owner_id:other},{...input,userId:other},{...input,status:"active"},{...input,updated_at:"client"},{...input,slug:"other"},{...input,operating_hours:null}])test("open strict payload "+JSON.stringify(body),async()=>{
 const f=setup();await assert.rejects(f.open(body),/SELLER_VALIDATION_ERROR/);assert.equal(f.calls.length,0);assert.equal((await f.api(body)).status,400);assert.equal(f.rpcCalls().length,0);
});
test("open API validates UUID/JSON/Origin and returns no-store",async()=>{
 const f=setup();for(const origin of ["https://evil.invalid",null,"null"]){assert.equal((await f.api(input,{origin})).status,403);assert.equal(f.calls.length,0);}
 assert.equal((await f.api(null,{raw:"not JSON"})).status,400);assert.equal((await f.api(input,{id:"bad"})).status,400);assert.equal(f.rpcCalls().length,0);
 const result=await f.api();assert.equal(result.status,200);assert.equal(result.headers.get("cache-control"),"no-store");assertSafe(await result.json());
});
for(const [error,code,status] of [[{code:"PGRST202",message:"PRIVATE"},"RESTAURANT_OPEN_RPC_UNAVAILABLE",503],[{code:"42883",message:"PRIVATE"},"RESTAURANT_OPEN_RPC_UNAVAILABLE",503],[{code:"42501",message:"PRIVATE"},"DATABASE_ACCESS_DENIED",403],[{code:"P0001",message:"NOT_ALLOWED"},"DATABASE_ACCESS_DENIED",403],[{code:"P0001",message:"INVALID_OPERATING_STATUS"},"RESTAURANT_OPEN_RPC_UNAVAILABLE",503],[{code:"XX000",message:"PRIVATE"},"RESTAURANT_OPEN_FAILED",500],[{code:"",message:"PRIVATE_NETWORK"},"RESTAURANT_OPEN_RESULT_UNKNOWN",503]])test("RPC error maps safely "+code+" "+error.code,async()=>{
 const f=setup({rpcError:error});const before=structuredClone(f.state);const response=await f.api();assert.equal(response.status,status);const result=await response.json();assert.equal(result.error.code,code);assertSafe(result);assert.deepEqual(f.state,before);assert.equal(f.rpcCalls().length,1);
});
for(const response of [null,[],{}, {success:false,operating_status:"open"},{success:true,operating_status:"closed"}])test("malformed RPC response stays uncertain, no mutation retry: "+JSON.stringify(response),async()=>{
 const f=setup({rpcResponse:response});const result=await f.api();assert.equal(result.status,503);assert.equal((await result.json()).error.code,"RESTAURANT_OPEN_RESULT_UNKNOWN");assert.equal(f.rpcCalls().length,1);assert.equal(f.writes().length,0);
});
test("network failure before/after commit never retries or compensates (mock)",async()=>{
 for(const option of ["rpcNetworkError","commitThenNetworkError"]){const f=setup({[option]:true});await assert.rejects(f.open(),/RESTAURANT_OPEN_RESULT_UNKNOWN/);assert.equal(f.rpcCalls().length,1);assert.equal(f.writes().length,0);assert.equal(f.state.restaurant.operating_status,option==="commitThenNetworkError"?"open":"closed");}
});
test("RPC supplied owner check can reject ownership change after precheck (contract model only)",async()=>{
 const f=setup({beforeOpenRpc:state=>{state.restaurant.owner_id=other;}});await assert.rejects(f.open(),/DATABASE_ACCESS_DENIED/);assert.equal(f.state.restaurant.operating_status,"closed");
});
test("concurrent open requests do not mutate fields outside RPC contract (mock, not DB locking proof)",async()=>{
 const f=setup();const before=structuredClone(f.state.restaurant);const results=await Promise.all([f.open(),f.open()]);
 assert.ok(results.every(r=>r.restaurant.operating_status==="open"));assert.equal(f.state.restaurant.operating_status,"open");
 for(const column of ["status","slug","operating_hours","owner_id","name"])assert.deepEqual(f.state.restaurant[column],before[column]);assert.equal(f.writes().length,0);
});

const access=(status="closed",patch={})=>({user:{id:userId,role:"seller",status:"active"},restaurant:{id:restaurantId,name:"TEST",slug:"stable",status:"active",operating_status:status,...patch}});
function client(options={}) {
 let actor={id:userId,role:"seller",status:"active"},reads=0,invalidations=0;const calls=[];
 const tools=load("../lib/seller/open-client.ts",{
  "@/store/useAuthStore":{useAuthStore:{getState:()=>({user:actor})}},
  "./access-client":{readSellerAccess:async()=>{reads++;return options.read?options.read(reads):access(reads===1?(options.before??"closed"):(options.after??"open"));},invalidateSellerAccess:()=>invalidations++},
 },{AbortController,setTimeout:options.setTimeout??setTimeout,clearTimeout:options.clearTimeout??clearTimeout,fetch:async(path,request)=>{calls.push({path,request});if(options.fetch)return options.fetch(request);if(options.network)throw Error("PRIVATE");return Response.json(options.body??{restaurant:{id:restaurantId,operating_status:"open"},alreadyOpen:false},{status:options.status??200});}});
 return {...tools,calls,reads:()=>reads,invalidations:()=>invalidations,actor:value=>{actor=value;}};
}
test("client reads before/after POST then invalidates, never writes client profile/status",async()=>{
 const f=client();const result=await f.openSellerRestaurant(userId,restaurantId);assert.equal(result.recovered,false);assert.equal(f.reads(),2);assert.equal(f.invalidations(),1);assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].path,`/api/seller/restaurants/${restaurantId}/open`);assert.equal(f.calls[0].request.credentials,"same-origin");assert.deepEqual(JSON.parse(f.calls[0].request.body),input);
});
test("client already-open preflight skips POST, paused never starts mutation",async()=>{
 const f=client({before:"open"});assert.equal((await f.openSellerRestaurant(userId,restaurantId)).alreadyOpen,true);assert.equal(f.calls.length,0);
 const paused=client({before:"paused"});await assert.rejects(paused.openSellerRestaurant(userId,restaurantId));assert.equal(paused.calls.length,0);
});
for(const options of [{network:true},{body:{}},{status:503,body:{error:{code:"RESTAURANT_OPEN_RESULT_UNKNOWN",message:"PRIVATE"}}}])test("uncertain client result reconciles by GET only "+JSON.stringify(options),async()=>{
 const f=client(options);assert.equal((await f.openSellerRestaurant(userId,restaurantId)).recovered,true);assert.equal(f.calls.length,1);assert.equal(f.reads(),2);
 const closed=client({...options,after:"closed"});await assert.rejects(closed.openSellerRestaurant(userId,restaurantId),error=>!error.message.includes("PRIVATE"));assert.equal(closed.calls.length,1);assert.equal(closed.reads(),2);
});
test("client rejects known API failure/missing RPC without false success or unconditional retry",async()=>{
 for(const [code,status]of [["RESTAURANT_OPEN_RPC_UNAVAILABLE",503],["DATABASE_ACCESS_DENIED",403],["RESTAURANT_NOT_FOUND",404]]){const f=client({status,body:{error:{code,message:"PRIVATE"}}});await assert.rejects(f.openSellerRestaurant(userId,restaurantId),e=>!e.message.includes("PRIVATE"));assert.equal(f.calls.length,1);assert.equal(f.invalidations(),0);}
});
test("client timeout aborts POST, cleans timer, reads state and does not resend (simulated timeout)",async()=>{
 let abort,cleared=0;const f=client({after:"closed",setTimeout(fn,ms){assert.equal(ms,15000);abort=fn;return 1;},clearTimeout(){cleared++;},fetch:request=>new Promise((resolve,reject)=>{request.signal.addEventListener("abort",()=>reject(Error("PRIVATE_ABORT")));})});
 const pending=f.openSellerRestaurant(userId,restaurantId);await new Promise(r=>setImmediate(r));abort();await assert.rejects(pending);assert.equal(f.calls.length,1);assert.equal(f.reads(),2);assert.equal(cleared,1);assert.equal(f.calls[0].request.signal.aborted,true);
});
test("200 response is not success when DB readback is closed/unavailable, and actor change cannot invalidate new context",async()=>{
 const closed=client({after:"closed"});await assert.rejects(closed.openSellerRestaurant(userId,restaurantId));
 const unavailable=client({read:async n=>{if(n===2)throw Error("PRIVATE");return access();}});await assert.rejects(unavailable.openSellerRestaurant(userId,restaurantId),e=>!e.message.includes("PRIVATE"));assert.equal(unavailable.invalidations(),0);
 let done;const f=client({fetch:()=>new Promise(resolve=>{done=resolve;})});const pending=f.openSellerRestaurant(userId,restaurantId);await new Promise(r=>setImmediate(r));f.actor({id:other,role:"seller",status:"active"});done(Response.json({restaurant:{id:restaurantId,operating_status:"open"},alreadyOpen:false}));await assert.rejects(pending);assert.equal(f.invalidations(),0);
});

function uiHarness(open) {
 let data=access(),loading=false,actor=userId,sc=0,rc=0,ec=0;const states=[],refs=[],effects=[],calls=[];
 const jsx=(type,props)=>({type,props});
 const {default:Component}=load("../components/features/seller/SellerOverviewView.tsx",{
  react:{useState(initial){const i=sc++;if(!(i in states))states[i]=initial;return [states[i],next=>{states[i]=typeof next==="function"?next(states[i]):next;}];},useRef(value){const i=rc++;return refs[i]??(refs[i]={current:value});},useEffect(fn){effects[ec++]??=fn();}},
  "react/jsx-runtime":{jsx,jsxs:jsx},"next/link":{default:"a"},"lucide-react":{},"@/components/layout/StudentHeader":{default:"header"},"./SellerSidebar":{default:"sidebar"},"./SellerAccessProblem":{default:"problem"},"@/styles/seller-overview.module.css":{default:{}},
  "./SellerAccessProvider":{useSellerAccess:()=>({data,loading})},"@/store/useAuthStore":{useAuthStore:{getState:()=>({user:{id:actor}})}},
  "@/lib/seller/open-client":{openSellerRestaurant:async(...args)=>{calls.push(args);return open(...args);}},
 });
 const render=()=>{sc=rc=ec=0;return Component();};const nodes=n=>!n||typeof n!=="object"?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
 const buttons=()=>nodes(render()).filter(n=>n.type==="button"&&(n.props.children==="Mở nhận đơn"||nodes(n).some(child=>child.type==="strong"&&child.props.children==="Mở nhận đơn")));
 return {render,nodes,buttons,calls,setData(value){data=value;},setLoading(value){loading=value;},setActor(value){actor=value;},unmount(){effects.forEach(fn=>fn?.());}};
}
test("dashboard and checklist share real handler, suppress duplicate requests and render context DB status only",async()=>{
 let done;const ui=uiHarness(()=>new Promise(resolve=>{done=resolve;}));const buttons=ui.buttons();assert.equal(buttons.length,3);assert.equal(buttons[0].props.disabled,false);
 buttons[0].props.onClick();buttons[1].props.onClick();assert.equal(ui.calls.length,1);assert.ok(ui.buttons().every(b=>b.props.disabled));assert.equal(JSON.stringify(ui.render()).includes("Đang mở…"),true);
 done({alreadyOpen:false,recovered:false});await new Promise(r=>setImmediate(r));assert.equal(ui.nodes(ui.render()).some(n=>n.props?.['data-open']===true),false);
 ui.setData(access("open"));const tree=ui.render();assert.ok(ui.nodes(tree).some(n=>n.props?.['data-open']===true));assert.ok(ui.nodes(tree).some(n=>n.props?.['data-done']===true));assert.equal(ui.buttons().length,0);ui.unmount();
});
test("dashboard shows failure without changing status; loading/role/paused disable opening",async()=>{
 const ui=uiHarness(async()=>{throw Error("RPC unavailable");});ui.buttons()[0].props.onClick();await new Promise(r=>setImmediate(r));assert.ok(ui.nodes(ui.render()).some(n=>n.props?.role==="alert"));assert.equal(ui.nodes(ui.render()).some(n=>n.props?.['data-open']===true),false);
 ui.setLoading(true);assert.ok(ui.buttons().every(b=>b.props.disabled));ui.setLoading(false);ui.setData({...access(),user:{id:userId,role:"student",status:"active"}});assert.ok(ui.buttons().every(b=>b.props.disabled));ui.setData(access("paused"));assert.ok(ui.buttons().every(b=>b.props.disabled));ui.unmount();
});
test("late dashboard response does not change another account or restaurant context",async()=>{
 for(const changed of ["actor","restaurant"]){let done;const ui=uiHarness(()=>new Promise(resolve=>{done=resolve;}));ui.buttons()[0].props.onClick();ui.setData(changed==="actor"?{...access(),user:{id:other,role:"seller",status:"active"}}:access("closed",{id:other}));if(changed==="actor")ui.setActor(other);ui.render();done({alreadyOpen:false,recovered:false});await new Promise(r=>setImmediate(r));const tree=ui.render();assert.equal(ui.nodes(tree).some(n=>n.props?.role==="status"||n.props?.role==="alert"),false);assert.equal(ui.nodes(tree).some(n=>n.props?.['data-open']===true),false);ui.unmount();}
});

// Closed is a supported explicit target, never a blind toggle.
test("close uses same session RPC, repeated close is no-op, and reopen preserves all other fields",async()=>{
 const f=setup({operatingStatus:"open"});const before=structuredClone(f.state);
 const close={operating_status:"closed"};const response=await f.api(close);assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.restaurant.operating_status,"closed");assert.equal(body.alreadyAtTarget,false);
 assert.equal(f.rpcCalls()[0].payload.p_operating_status,"closed");const closed=structuredClone(f.state);
 assert.equal((await f.open(close)).alreadyAtTarget,true);assert.deepEqual(f.state,closed);assert.equal(f.rpcCalls().length,1);
 for(let i=0;i<3;i++){await f.open();await f.open(close);}
 assert.equal(f.state.restaurant.operating_status,"closed");assert.equal(f.writes().length,0);
 for(const column of ["status","owner_id","slug","name","operating_hours"])assert.deepEqual(f.state.restaurant[column],before.restaurant[column]);
 assert.deepEqual(f.state.banks,before.banks);assert.equal(f.profileRole(),"seller");
 assert.ok(f.calls.every(call=>call.kind!=="rpc"||call.name==="set_restaurant_operating_status"));
});

for(const options of [{noUser:true},{status:"inactive"},{role:"staff"},{role:"student"},{notOwner:true},{noRestaurant:true}])test("close permission "+JSON.stringify(options),async()=>{
 const f=setup({...options,operatingStatus:"open"});const before=structuredClone(f.state);
 assert.ok((await f.api({operating_status:"closed"})).status>=400);assert.equal(f.rpcCalls().length,0);assert.deepEqual(f.state,before);
});

test("close rejects paused, wrong types and unrelated fields without writes",async()=>{
 for(const body of [{operating_status:["closed"]},{operating_status:{value:"open"}},{operating_status:"closed",status:"inactive"},{operating_status:"closed",owner_id:other}]){
  const f=setup({operatingStatus:"open"});assert.equal((await f.api(body)).status,400);assert.equal(f.calls.length,1);assert.equal(f.rpcCalls().length,0);
 }
 const f=setup({operatingStatus:"paused"});assert.equal((await f.api({operating_status:"closed"})).status,409);assert.equal(f.rpcCalls().length,0);
});

test("concurrent close requests have the same target and cannot toggle back open (mock only)",async()=>{
 const f=setup({operatingStatus:"open"});const responses=await Promise.all([f.open({operating_status:"closed"}),f.open({operating_status:"closed"})]);
 assert.ok(responses.every(result=>result.restaurant.operating_status==="closed"));assert.equal(f.state.restaurant.operating_status,"closed");
 assert.ok(f.rpcCalls().every(call=>call.payload.p_operating_status==="closed"));
});

test("closing client sends closed, reconciles timeout and never resends mutation",async()=>{
 for(const options of [{},{network:true}]){
  const f=client({...options,before:"open",after:"closed",body:{restaurant:{id:restaurantId,operating_status:"closed"},alreadyOpen:false,alreadyAtTarget:false}});
  await f.openSellerRestaurant(userId,restaurantId,"closed");assert.equal(f.calls.length,1);assert.equal(f.reads(),2);assert.equal(f.invalidations(),1);
  assert.deepEqual(JSON.parse(f.calls[0].request.body),{operating_status:"closed"});
 }
 const noOp=client({before:"closed"});assert.equal((await noOp.openSellerRestaurant(userId,restaurantId,"closed")).alreadyAtTarget,true);assert.equal(noOp.calls.length,0);
 const failed=client({before:"open",after:"open",network:true});await assert.rejects(failed.openSellerRestaurant(userId,restaurantId,"closed"));assert.equal(failed.calls.length,1);
});

test("desktop and mobile closing buttons share pending guard and keep context status on error",async()=>{
 let reject;const ui=uiHarness(()=>new Promise((resolve,no)=>{reject=no;}));ui.setData(access("open"));
 const buttons=ui.nodes(ui.render()).filter(n=>n.type==="button"&&n.props.children==="Đóng cửa hàng");assert.equal(buttons.length,2);assert.ok(buttons.every(b=>!b.props.disabled));
 buttons[0].props.onClick();buttons[1].props.onClick();assert.equal(ui.calls.length,1);assert.equal(ui.calls[0][2],"closed");assert.ok(JSON.stringify(ui.render()).includes("Đang đóng…"));
 reject(Error("Không thể đổi trạng thái"));await new Promise(r=>setImmediate(r));assert.ok(ui.nodes(ui.render()).some(n=>n.props?.role==="alert"));assert.ok(ui.nodes(ui.render()).some(n=>n.props?.["data-open"]===true));ui.unmount();
});


test("closing RPC failure before/after commit stays unknown and never retries",async()=>{
 for(const option of ["rpcNetworkError","commitThenNetworkError"]){
  const f=setup({operatingStatus:"open",[option]:true});const response=await f.api({operating_status:"closed"});
  assert.equal(response.status,503);assert.equal((await response.json()).error.code,"RESTAURANT_OPEN_RESULT_UNKNOWN");
  assert.equal(f.rpcCalls().length,1);assert.equal(f.writes().length,0);assert.equal(f.state.restaurant.operating_status,option==="commitThenNetworkError"?"closed":"open");
 }
 const denied=setup({operatingStatus:"open",rpcError:{code:"42501",message:"PRIVATE"}});const before=structuredClone(denied.state);
 const response=await denied.api({operating_status:"closed"});assert.equal(response.status,403);assertSafe(await response.json());assert.deepEqual(denied.state,before);
});


// Contract integration: real browser helper + access parser + routes + services.
// Only Auth/SDK/network are substituted; no live database is contacted.
function wiredClient(options={}) {
 const f=setup({operatingStatus:"open",...options});const rawFrom=f.client.from.bind(f.client);
 f.client.from=table=>{
  const q=rawFrom(table);
  if(table==="restaurants")q.limit=async()=>({data:[{...f.state.restaurant}],error:null});
  if(table==="users"){
   const read=q.maybeSingle.bind(q);q.maybeSingle=async()=>{
    const result=await read();return {...result,data:result.data?{...result.data,id:userId,work_for_restaurant_id:null}:null};
   };
  }
  return q;
 };
 const rpc=f.client.rpc.bind(f.client);f.client.rpc=async(name,args)=>{
  assert.equal(name,"set_restaurant_operating_status");
  assert.deepEqual(Object.keys(args).sort(),["p_operating_status","p_restaurant_id"]);
  assert.ok(["open","closed","paused"].includes(args.p_operating_status));
  assert.equal(args.p_restaurant_id,restaurantId);
  const result=await rpc(name,args);return options.emptySdkEnvelope?undefined:result;
 };
 const accessServices=load("../services/seller-access.service.ts");
 const accessRoute=load("../app/api/seller/access/route.ts",{
  "next/server":{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  "@/lib/supabase/server":{createClient:async()=>f.client},"@/services/seller-access.service":accessServices,
 });
 const requests=[];const fetch=async(path,request)=>{
  if(path==="/api/seller/access")return accessRoute.GET();
  requests.push({method:request.method,path,body:JSON.parse(request.body),contentType:request.headers["Content-Type"]});
  const result=await f.api(JSON.parse(request.body));
  if(options.corruptResponse && result.ok)return Response.json({unexpected:true});
  return result;
 };
 const accessClient=load("../lib/seller/access-client.ts",{}, {fetch,window:{dispatchEvent(){}},Event});
 const tools=load("../lib/seller/open-client.ts",{
  "@/store/useAuthStore":{useAuthStore:{getState:()=>({user:{id:userId,role:"seller",status:"active"}})}},
  "./access-client":accessClient,
 },{fetch,AbortController,setTimeout,clearTimeout});
 return {...f,...tools,requests};
}

test("closed traverses actual client, HTTP routes, validation, RPC mapping and closed readback",async()=>{
 const f=wiredClient();const before=structuredClone(f.state.restaurant);
 const result=await f.openSellerRestaurant(userId,restaurantId,"closed");assert.equal(result.recovered,false);
 assert.deepEqual(f.requests,[{method:"POST",path:`/api/seller/restaurants/${restaurantId}/open`,body:{operating_status:"closed"},contentType:"application/json"}]);
 assert.equal(f.state.restaurant.operating_status,"closed");
 for(const key of ["avatar_url","operating_hours","status","owner_id"])assert.deepEqual(f.state.restaurant[key],before[key]);
 assert.equal(f.writes().length,0);
 assert.ok(!f.calls.some(call=>call.filters?.some(([key])=>key==="operating_status")));
 await f.openSellerRestaurant(userId,restaurantId,"closed");assert.equal(f.requests.length,1);
 await f.openSellerRestaurant(userId,restaurantId,"open");assert.equal(f.state.restaurant.operating_status,"open");
});

test("real response parser reconciles committed close after corrupt HTTP or network failure",async()=>{
 for(const options of [{corruptResponse:true},{commitThenNetworkError:true},{emptySdkEnvelope:true}]){
  const f=wiredClient(options);assert.equal((await f.openSellerRestaurant(userId,restaurantId,"closed")).recovered,true);
  assert.equal(f.state.restaurant.operating_status,"closed");assert.equal(f.requests.length,1);assert.equal(f.rpcCalls().length,1);
 }
});

test("validation message is pre-mutation and not a rejection of a closed RPC response",async()=>{
 const f=setup({operatingStatus:"open"});
 for(const [body,id,field] of [[{operating_status:false},restaurantId,"operating_status"],[{operating_status:"closed",status:"inactive"},restaurantId,"payload"],[{operating_status:"closed"},"not-a-uuid","restaurantId"]]){
  const response=await f.api(body,{id});assert.equal(response.status,400);const result=await response.json();
  assert.equal(result.error.code,"VALIDATION_ERROR");assert.ok(result.error.message.includes(field));assert.equal(f.rpcCalls().length,0);
 }
});

test("empty SDK envelope after committed close remains unknown for readback, never a definite write failure",async()=>{
 for(const envelope of [undefined,null]){
  const f=setup({operatingStatus:"open"});const rpc=f.client.rpc.bind(f.client);
  f.client.rpc=async(...args)=>{await rpc(...args);return envelope;};
  const response=await f.api({operating_status:"closed"});
  assert.equal(f.state.restaurant.operating_status,"closed");assert.equal(f.rpcCalls().length,1);
  assert.equal(response.status,503);assert.equal((await response.json()).error.code,"RESTAURANT_OPEN_RESULT_UNKNOWN");
  assert.equal(f.writes().length,0);
 }
});
