import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, load, userId, restaurantId, bankId, other } from "./seller-sdk-fixture.mjs";
const plain=value=>JSON.parse(JSON.stringify(value));
const schedule=load("../lib/seller/schedule-client.ts");
const shop={id:restaurantId,name:"QUAN TEST",description:"TEST ONLY",location:"KTX TEST",slug:"stable-slug",status:"inactive",operating_status:"closed",avatar_url:null,operating_hours:null};
const bank={id:bankId,restaurant_id:restaurantId,bank_name:"TEST BANK",account_no:"000123",account_name:"TEST ONLY",is_default:false};

test('restaurant upload validates file type and size before any network call',async()=>{
 const {CloudinaryService}=load('../services/cloudinary.service.ts');
 for(const file of [{type:'text/plain',size:10},{type:'image/png',size:5*1024*1024+1}]){
  await assert.rejects(CloudinaryService.uploadImage(file));
 }
 for(const type of ['image/jpeg','image/png','image/webp'])assert.equal(CloudinaryService.validateImageFile({type,size:1024}),null);
});

test('avatar save requires persisted URL acknowledgment before invalidating access',async()=>{
 const h=helper();
 await assert.rejects(h.updateSellerRestaurant(userId,restaurantId,{avatar_url:'https://example.invalid/new.png'}),/Chưa xác nhận được ảnh/);
 assert.equal(h.invalidations(),0);
});

function helper(options={}) {
 let actor={id:userId,role:"seller",status:"active"}, invalidations=0;const calls=[];
 const exports=load("../lib/seller/management-client.ts",{
  "@/store/useAuthStore":{useAuthStore:{getState:()=>({user:actor})}},
  "./access-client":{invalidateSellerAccess:()=>invalidations++},
 },{fetch:async(path,request)=>{calls.push({path,request});if(options.fetch)return options.fetch();if(options.network)throw Error("PRIVATE");return Response.json(options.body??{restaurant:shop},{status:options.status??200});}});
 return {...exports,calls,changeActor(value){actor=value;},invalidations:()=>invalidations};
}

test("management client PATCHes only submitted fields and invalidates shared DB access",async()=>{
 const f=helper();await f.updateSellerRestaurant(userId,restaurantId,{name:"NEW"});
 assert.equal(f.calls[0].path,`/api/seller/restaurants/${restaurantId}`);assert.equal(f.calls[0].request.method,"PATCH");assert.equal(f.calls[0].request.credentials,"same-origin");
 assert.deepEqual(JSON.parse(f.calls[0].request.body),{name:"NEW"});assert.equal(f.invalidations(),1);
});
test("client uses actual bank GET/POST/PATCH routes with string account and partial body",async()=>{
 const read=helper({body:{banks:[bank]}});assert.equal((await read.readSellerBanks(userId,restaurantId)).banks[0].account_no,"000123");assert.equal(read.calls[0].request.method,"GET");assert.equal(read.calls[0].request.body,undefined);
 const write=helper({body:{bank}});await write.saveSellerBank(userId,restaurantId,null,{bank_name:bank.bank_name,account_name:bank.account_name,account_no:bank.account_no});
 await write.saveSellerBank(userId,restaurantId,bankId,{account_name:"NEW"});assert.equal(write.calls[0].request.method,"POST");assert.equal(write.calls[1].request.method,"PATCH");assert.ok(write.calls[1].path.endsWith(bankId));assert.deepEqual(JSON.parse(write.calls[1].request.body),{account_name:"NEW"});
});
for(const options of [{network:true},{status:503,body:{error:{code:"BANK_DEFAULT_ATOMICITY_UNAVAILABLE",message:"PRIVATE"}}},{status:500,body:{error:{code:"OTHER",message:"PRIVATE"}}},{body:{restaurant:{...shop,id:other}}}]) test("client never fakes save/invalidation on failure "+JSON.stringify(options),async()=>{
 const f=helper(options);await assert.rejects(f.updateSellerRestaurant(userId,restaurantId,{name:"NEW"}),error=>!error.message.includes("PRIVATE"));assert.equal(f.invalidations(),0);assert.equal(f.calls.length,1);
});
test("client masks late result after identity change and rejects response for another shop",async()=>{
 let done;const f=helper({fetch:()=>new Promise(resolve=>{done=resolve;})});const pending=f.readSellerBanks(userId,restaurantId);f.changeActor({id:other,role:"seller",status:"active"});done(Response.json({banks:[bank]}));await assert.rejects(pending);assert.equal(f.invalidations(),0);
 const wrong=helper({body:{banks:[{...bank,restaurant_id:other}]}});await assert.rejects(wrong.readSellerBanks(userId,restaurantId));
});

test("schedule decodes version1 only, distinguishes later/unknown, preserves day-specific hours",()=>{
 assert.equal(schedule.readShopSchedule(null).mode,"later");assert.equal(schedule.readShopSchedule(null).recognized,true);
 for(const hours of [{legacy:true},{version:2,timezone:"Asia/Ho_Chi_Minh",days:{}},{version:1,timezone:"UTC",days:{}},{version:1,timezone:"Asia/Ho_Chi_Minh",days:{mon:{open:"24:00",close:"25:00"}}}])assert.equal(schedule.readShopSchedule(hours).recognized,false);
 const parsed=schedule.readShopSchedule({version:1,timezone:"Asia/Ho_Chi_Minh",days:{mon:{open:"09:00",close:"12:00"},fri:{open:"10:00",close:"15:00"}}});assert.equal(parsed.mode,"daily");
 assert.deepEqual(plain(schedule.shopSchedulePayload(parsed.mode,parsed.days,"10:00","14:00")),{mode:"daily",days:[{id:"mon",open:"09:00",close:"12:00"},{id:"fri",open:"10:00",close:"15:00"}]});
 assert.deepEqual(plain(schedule.shopSchedulePayload("same",parsed.days,"08:00","11:00")),{mode:"same",dayIds:["mon","fri"],openTime:"08:00",closeTime:"11:00"});
 assert.deepEqual(plain(schedule.shopSchedulePayload("later",parsed.days,"bad","bad")),{mode:"later"});
 assert.throws(()=>schedule.shopSchedulePayload("same",parsed.days,"15:00","10:00"));assert.throws(()=>schedule.shopSchedulePayload("daily",schedule.readShopSchedule(null).days,"10:00","14:00"));
});

function harness(file,exportName,mocks={},globals={}) {
 let stateCursor=0,refCursor=0,effectCursor=0,memoCursor=0,props;const states=[],refs=[],effects=[],memos=[];
 const changed=(a,b)=>!a||a.length!==b?.length||a.some((v,i)=>v!==b[i]);
 const jsx=(type,props,key)=>({type,props,key});
 const react={
  useState(initial){const i=stateCursor++;if(!(i in states))states[i]=typeof initial==="function"?initial():initial;return [states[i],next=>{states[i]=typeof next==="function"?next(states[i]):next;}];},
  useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},
  useEffect(fn,deps){const i=effectCursor++;if(changed(effects[i]?.deps,deps))effects[i]={...effects[i],fn,deps,pending:true};},
  useCallback(fn,deps){const i=memoCursor++;if(changed(memos[i]?.deps,deps))memos[i]={fn,deps};return memos[i].fn;},
 };
 const exports=load(file,{react,"react/jsx-runtime":{jsx,jsxs:jsx},"next/image":{default:"img"},"next/link":{default:"a"},"lucide-react":{},
  "./StaffRecruitment":{default:"StaffRecruitment"},"./SellerSidebar":{default:"SellerSidebar"},"@/components/layout/StudentHeader":{default:"StudentHeader"},
  "./SellerAccessProvider":{useSellerAccess:()=>({data:{user:{id:userId},restaurant:shop}})},
  "@/store/useAuthStore":{useAuthStore:{getState:()=>({user:{id:userId}})}},
  "@/lib/seller/open-client":{},"@/lib/seller/management-client":{},"@/lib/seller/schedule-client":schedule,"@/services/cloudinary.service":{CloudinaryService:{uploadImage:async()=>({secureUrl:"https://example.invalid/test.png"})}},
  "@/styles/seller-shop.module.css":{default:{}},"@/styles/seller-menu.module.css":{default:{}},"@/styles/seller-payments.module.css":{default:{}},...mocks},globals);
 const Component=exports[exportName];
 const render=(next=props)=>{props=next;stateCursor=refCursor=effectCursor=memoCursor=0;return Component(props);};
 const nodes=n=>!n||typeof n!=="object"?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
 const flush=()=>{for(const effect of effects)if(effect.pending){effect.cleanup?.();effect.pending=false;effect.cleanup=effect.fn();}};
 return {render,nodes,flush,unmount(){effects.forEach(e=>e.cleanup?.());}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const event={preventDefault(){}};
function shopUI(update=async()=>({restaurant:shop}),initial=shop){const calls=[];const ui=harness("../components/features/seller/SellerShopView.tsx","ShopForm",{"@/lib/seller/management-client":{updateSellerRestaurant:async(...args)=>{calls.push(args);return update(...args);}}});ui.render({initial,actorId:userId});ui.flush();return {...ui,calls};}

test("actual shop form only PATCHes dirty information, never phone/avatar/slug/status/schedule",async()=>{
 const ui=shopUI();let tree=ui.render();ui.nodes(tree).find(n=>n.type==="input"&&n.props.value===shop.name).props.onChange({target:{value:"NEW"}});
 await ui.nodes(ui.render()).find(n=>n.type==="form").props.onSubmit(event);assert.deepEqual(plain(ui.calls[0]),[userId,restaurantId,{name:"NEW"}]);
 assert.ok(ui.nodes(ui.render()).some(n=>n.props?.role==="status"));assert.ok(ui.nodes(ui.render()).some(n=>n.type==="StaffRecruitment"));
});
test("shop does not report saved on failure; suppresses concurrent clicks",async()=>{
 let reject;const ui=shopUI(()=>new Promise((_,fail)=>{reject=fail;}));ui.nodes(ui.render()).find(n=>n.type==="input"&&n.props.value===shop.name).props.onChange({target:{value:"NEW"}});
 const save=ui.nodes(ui.render()).find(n=>n.type==="form").props.onSubmit;const pending=save(event);await save(event);assert.equal(ui.calls.length,1);
 reject(Error("API rejected"));await pending;assert.ok(ui.nodes(ui.render()).some(n=>n.props?.role==="alert"));assert.ok(!ui.nodes(ui.render()).some(n=>n.props?.role==="status"));
});
test("shop schedule later sends replacement only; unknown legacy hours are not resent on info save",async()=>{
 const ui=shopUI(undefined,{...shop,operating_hours:{legacy:true}});let tree=ui.render();assert.ok(ui.nodes(tree).some(n=>n.props?.role==="status"));
 ui.nodes(tree).find(n=>n.type==="input"&&n.props.value===shop.name).props.onChange({target:{value:"NEW"}});
 await ui.nodes(ui.render()).filter(n=>n.type==="form")[0].props.onSubmit(event);assert.deepEqual(plain(ui.calls[0][2]),{name:"NEW"});
 await ui.nodes(ui.render()).filter(n=>n.type==="form")[1].props.onSubmit(event);assert.deepEqual(plain(ui.calls[1][2]),{schedule:{mode:"later"}});
});

function paymentUI(options={}){const calls=[];const ui=harness("../components/features/seller/SellerPaymentView.tsx","BankManager",{"@/lib/seller/management-client":{
 readSellerBanks:async()=>{if(options.readError)throw Error("read failed");return {banks:options.banks??[bank]};},
 saveSellerBank:async(...args)=>{calls.push(args);if(options.write)return options.write(...args);if(options.blocked)throw Error("Chuyển mặc định bị chặn; giữ nguyên.");return {bank};}
 }});ui.render({actorId:userId,restaurantId});ui.flush();return {...ui,calls};}

test("actual bank UI reads DB list, submits partial edit and preserves account string/default",async()=>{
 const ui=paymentUI();await tick();let tree=ui.render();ui.nodes(tree).find(n=>n.type==="button"&&String(n.props.children).startsWith("Sửa tài khoản")).props.onClick();tree=ui.render();
 ui.nodes(tree).find(n=>n.props?.name==="account_name").props.onChange({target:{value:"NEW"}});await ui.nodes(ui.render()).find(n=>n.type==="form").props.onSubmit(event);
 assert.deepEqual(plain(ui.calls[0]),[userId,restaurantId,bankId,{account_name:"NEW"}]);assert.ok(ui.nodes(ui.render()).some(n=>n.props?.role==="status"));ui.unmount();
});
test("actual bank UI create keeps leading zeros and false default, no artificial numeric length rule",async()=>{
 const ui=paymentUI({banks:[]});await tick();for(const [name,value]of [["bank_name","TEST"],["account_no","0001 A"],["account_name","TEST ONLY"]])ui.nodes(ui.render()).find(n=>n.props?.name===name).props.onChange({target:{value}});
 await ui.nodes(ui.render()).find(n=>n.type==="form").props.onSubmit(event);assert.equal(ui.calls[0][2],null);assert.equal(ui.calls[0][3].account_no,"0001 A");assert.equal(ui.calls[0][3].is_default,false);ui.unmount();
});
test("bank UI never simulates default switch or success when backend blocks",async()=>{
 const ui=paymentUI({blocked:true,banks:[{...bank,is_default:true},{...bank,id:other,account_no:"00999"}]});await tick();let tree=ui.render();ui.nodes(tree).filter(n=>n.type==="button"&&String(n.props.children).startsWith("Sửa tài khoản"))[1].props.onClick();tree=ui.render();ui.nodes(tree).find(n=>n.props?.type==="checkbox").props.onChange({target:{checked:true}});
 await ui.nodes(ui.render()).find(n=>n.type==="form").props.onSubmit(event);tree=ui.render();assert.ok(ui.nodes(tree).some(n=>n.props?.role==="alert"));assert.ok(!ui.nodes(tree).some(n=>n.props?.role==="status"));assert.ok(ui.nodes(tree).some(n=>n.type==="h3"&&String(n.props.children).includes("Mặc định")));ui.unmount();
});
test("bank read failure blocks save; component keys isolate accounts and shop forms",async()=>{
 const ui=paymentUI({readError:true});await tick();assert.ok(ui.nodes(ui.render()).some(n=>n.type==="fieldset"&&n.props.disabled));await ui.nodes(ui.render()).find(n=>n.type==="form").props.onSubmit(event);assert.equal(ui.calls.length,0);ui.unmount();
 for(const file of ["SellerPaymentView","SellerShopView"]){let actor=userId;const view=harness(`../components/features/seller/${file}.tsx`,"default",{"./SellerAccessProvider":{useSellerAccess:()=>({data:{user:{id:actor},restaurant:shop}})}});const key=()=>view.nodes(view.render({})).find(n=>typeof n.type==="function").key;assert.equal(key(),`${userId}:${restaurantId}`);actor=other;assert.equal(key(),`${other}:${restaurantId}`);}
});
test("bank form prevents duplicate submissions and ignores completion after unmount",async()=>{
 let done;const ui=paymentUI({write:()=>new Promise(resolve=>{done=resolve;})});await tick();let tree=ui.render();ui.nodes(tree).find(n=>n.type==="button"&&String(n.props.children).startsWith("Sửa tài khoản")).props.onClick();tree=ui.render();
 ui.nodes(tree).find(n=>n.props?.name==="account_name").props.onChange({target:{value:"NEW"}});const submit=ui.nodes(ui.render()).find(n=>n.type==="form").props.onSubmit;
 const pending=submit(event);await submit(event);assert.equal(ui.calls.length,1);ui.unmount();done({bank});await pending;assert.ok(!ui.nodes(ui.render()).some(n=>n.props?.role==="status"));
});

test('shop saves uploaded avatar, preserves it on text-only save and supports explicit removal',async()=>{
 const ui=shopUI(async(a,id,patch)=>({restaurant:{...shop,...patch}}));
 const file=ui.nodes(ui.render()).find(n=>n.type==='input'&&n.props.type==='file');await file.props.onChange({target:{files:[{}],value:'x'}});await tick();
 await ui.nodes(ui.render()).find(n=>n.type==='form').props.onSubmit(event);assert.equal(ui.calls[0][2].avatar_url,'https://example.invalid/test.png');
 ui.nodes(ui.render()).find(n=>n.type==='input'&&n.props.value===shop.name).props.onChange({target:{value:'NEW'}});
 await ui.nodes(ui.render()).find(n=>n.type==='form').props.onSubmit(event);assert.deepEqual(plain(ui.calls[1][2]),{name:'NEW'});
 ui.nodes(ui.render()).find(n=>n.type==='button'&&n.props.children==='Xóa ảnh').props.onClick();await ui.nodes(ui.render()).find(n=>n.type==='form').props.onSubmit(event);assert.equal(ui.calls[2][2].avatar_url,null);ui.unmount();
});
test('late upload cannot replace latest image, failed upload prevents success',async()=>{
 const pending=[];const calls=[];
 const ui=harness('../components/features/seller/SellerShopView.tsx','ShopForm',{
  '@/services/cloudinary.service':{CloudinaryService:{uploadImage:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))}},
  '@/lib/seller/management-client':{updateSellerRestaurant:async(a,id,patch)=>{calls.push(patch);return {restaurant:{...shop,...patch}};}}
 });ui.render({initial:shop,actorId:userId});ui.flush();
 const choose=()=>ui.nodes(ui.render()).find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[{}],value:'x'}});
 choose();choose();pending[1].resolve({secureUrl:'https://example.invalid/new.png'});await tick();pending[0].resolve({secureUrl:'https://example.invalid/old.png'});await tick();
 await ui.nodes(ui.render()).find(n=>n.type==='form').props.onSubmit(event);assert.equal(calls[0].avatar_url,'https://example.invalid/new.png');
 choose();pending[2].reject(Error('upload failed'));await tick();await ui.nodes(ui.render()).find(n=>n.type==='form').props.onSubmit(event);assert.equal(calls.length,1);assert.ok(ui.nodes(ui.render()).some(n=>n.props?.role==='alert'));ui.unmount();
});


test('shop status uses explicit server target, blocks double click and waits for shared DB context',async()=>{
 let done;const calls=[];const ui=harness('../components/features/seller/SellerShopView.tsx','ShopForm',{
  '@/lib/seller/open-client':{openSellerRestaurant:async(...args)=>{calls.push(args);return new Promise(resolve=>{done=resolve;});}}
 });const initial={...shop,operating_status:'open'};ui.render({initial,actorId:userId});ui.flush();
 const close=()=>ui.nodes(ui.render()).find(n=>n.type==='button'&&n.props.children==='Đóng cửa hàng');
 const click=close().props.onClick;click();click();assert.equal(calls.length,1);assert.deepEqual(calls[0],[userId,restaurantId,'closed']);
 assert.ok(ui.nodes(ui.render()).some(n=>n.type==='button'&&n.props.children==='Đang đóng…'&&n.props.disabled));
 done({recovered:false});await tick();assert.ok(close());
 ui.render({initial:{...initial,operating_status:'closed'},actorId:userId});assert.ok(ui.nodes(ui.render()).some(n=>n.type==='button'&&n.props.children==='Mở nhận đơn'&&!n.props.disabled));ui.unmount();
});

test('shop close failure preserves confirmed status and reports error',async()=>{
 const ui=harness('../components/features/seller/SellerShopView.tsx','ShopForm',{
  '@/lib/seller/open-client':{openSellerRestaurant:async()=>{throw Error('Không thể xác nhận trạng thái');}}
 });ui.render({initial:{...shop,operating_status:'open'},actorId:userId});ui.flush();
 ui.nodes(ui.render()).find(n=>n.type==='button'&&n.props.children==='Đóng cửa hàng').props.onClick();await tick();
 assert.ok(ui.nodes(ui.render()).some(n=>n.props?.role==='alert'));assert.ok(ui.nodes(ui.render()).some(n=>n.props?.['data-open']===true));assert.ok(!ui.nodes(ui.render()).some(n=>n.props?.role==='status'));ui.unmount();
});


test('shop contact loads saved string and submits only dirty phone, then permits explicit clear',async()=>{
 const ui=shopUI(async(a,id,patch)=>({restaurant:{...shop,...patch}}),{...shop,contact_phone:'0012345678',contact_phone_available:true});
 const phone=()=>ui.nodes(ui.render()).find(n=>n.props?.name==='contact_phone');assert.equal(phone().props.value,'0012345678');
 phone().props.onChange({target:{value:'0098765432'}});await ui.nodes(ui.render()).find(n=>n.type==='form').props.onSubmit(event);
 assert.deepEqual(plain(ui.calls[0][2]),{contact_phone:'0098765432'});
 phone().props.onChange({target:{value:''}});await ui.nodes(ui.render()).find(n=>n.type==='form').props.onSubmit(event);assert.equal(ui.calls[1][2].contact_phone,null);ui.unmount();
});
test('shop has no fake public link without saved slug and phone stays unavailable on old DB',()=>{
 const ui=shopUI(undefined,{...shop,slug:''});const tree=ui.render();
 assert.equal(ui.nodes(tree).find(n=>n.props?.name==='contact_phone').props.disabled,true);
 assert.ok(ui.nodes(tree).filter(n=>n.type==='button'&&(n.props['aria-label']==='Sao chép đường dẫn quán'||String(n.props.children).includes('Sao chép link quán'))).every(n=>n.props.disabled));
 assert.ok(!ui.nodes(tree).some(n=>n.props?.href?.startsWith('/restaurants/')));ui.unmount();
});


test('shop copy uses saved slug and deployment origin, never a demo domain',async()=>{
 const copied=[];const ui=harness('../components/features/seller/SellerShopView.tsx','ShopForm',{}, {
  window:{location:{origin:'https://food.example:8443'}},navigator:{clipboard:{writeText:async value=>copied.push(value)}},
 });ui.render({initial:shop,actorId:userId});ui.flush();
 await ui.nodes(ui.render()).find(n=>n.type==='button'&&n.props['aria-label']==='Sao chép đường dẫn quán').props.onClick();await tick();
 assert.deepEqual(copied,['https://food.example:8443/restaurants/'+shop.slug]);ui.unmount();
});


test('restaurant validation retains field-specific safe guidance instead of blaming schedule',async()=>{
 const f=helper({status:400,body:{error:{code:'VALIDATION_ERROR',field:'contact_phone',message:'PRIVATE'}}});
 await assert.rejects(f.updateSellerRestaurant(userId,restaurantId,{contact_phone:'bad'}),e=>e.message.includes('Số điện thoại liên hệ')&&!e.message.includes('lịch')&&!e.message.includes('PRIVATE'));
 assert.equal(f.invalidations(),0);
});


test('phone-only form traverses serializer, client, PATCH route and service without serializing draft schedule',async()=>{
 const db=fixture();db.state.restaurant.contact_phone=null;const initial={...db.state.restaurant,contact_phone_available:true};const before=structuredClone(db.state.restaurant);let invalidations=0;
 const route=load('../app/api/seller/restaurants/[restaurantId]/route.ts',{
  'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  '@/lib/supabase/server':{createClient:async()=>db.client},'@/services/seller.service':db,
 });
 const requests=[];
 const realClient=load('../lib/seller/management-client.ts',{
  '@/store/useAuthStore':{useAuthStore:{getState:()=>({user:{id:userId,role:'seller',status:'active'}})}},
  './access-client':{invalidateSellerAccess:()=>invalidations++},
 },{fetch:async(path,options)=>{
  requests.push({method:options.method,body:JSON.parse(options.body)});
  const request=new Request('http://localhost:3000'+path,{method:options.method,headers:{...options.headers,Origin:'http://localhost:3000'},body:options.body});
  return route.PATCH(request,{params:Promise.resolve({restaurantId})});
 }});
 const ui=harness('../components/features/seller/SellerShopView.tsx','ShopForm',{'@/lib/seller/management-client':realClient});ui.render({initial,actorId:userId});ui.flush();
 ui.nodes(ui.render()).find(n=>n.type==='input'&&n.props.type==='radio').props.onChange();
 const time=ui.nodes(ui.render()).find(n=>n.type==='select');time.props.onChange({target:{value:'23:45'}});
 ui.nodes(ui.render()).find(n=>n.props?.name==='contact_phone').props.onChange({target:{value:'0123456789'}});
 await ui.nodes(ui.render()).find(n=>n.type==='form').props.onSubmit(event);
 assert.deepEqual(requests,[{method:'PATCH',body:{contact_phone:'0123456789'}}]);assert.equal(db.state.restaurant.contact_phone,'0123456789');
 assert.deepEqual(Object.keys(db.writes()[0].values).sort(),['contact_phone','updated_at']);assert.equal(invalidations,1);
 for(const field of ['operating_hours','avatar_url','slug','status','operating_status','owner_id'])assert.deepEqual(db.state.restaurant[field],before[field]);
 assert.ok(ui.nodes(ui.render()).some(n=>n.props?.role==='status'));ui.unmount();
 const reread=await db.client.from('restaurants').select('contact_phone').eq('id',restaurantId).maybeSingle();assert.equal(reread.data.contact_phone,'0123456789');
 const reloaded=shopUI(undefined,{...initial,...reread.data});assert.equal(reloaded.nodes(reloaded.render()).find(n=>n.props?.name==='contact_phone').props.value,'0123456789');reloaded.unmount();
});
