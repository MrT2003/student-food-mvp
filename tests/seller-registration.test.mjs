import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { fixture, userId, other, restaurantId, registration, assertSafe, testPin } from "./seller-sdk-fixture.mjs";

for (const patch of [{name:" "},{name:123},{owner_id:other},{role:"seller"},{updated_at:"now"},{cash:false}]) {
  test('registration validates before SDK access: '+JSON.stringify(patch), async()=>{
    const f=fixture({role:"student"});
    await assert.rejects(f.SellerServices.register(userId,registration(patch),f.client),/SELLER_VALIDATION_ERROR/);
    assert.equal(f.calls.length,0);
  });
}
const invalidPins=[undefined,null,Number(testPin()),true,[],{},'',testPin().slice(1),testPin()+'0',' '+testPin(),testPin()+' ',String.fromCharCode(0xff10).repeat(4),'abcd'];
for(const [index,value] of invalidPins.entries()) {
 test('PIN runtime validation rejects invalid case '+index+' without reflecting its value',async()=>{
  const f=fixture({role:'student'});const input=registration({appLockPin:value});
  if(value===undefined) delete input.appLockPin;
  await assert.rejects(f.SellerServices.register(userId,input,f.client),error=>error instanceof f.SellerValidationError&&error.message==='SELLER_VALIDATION_ERROR: appLockPin: PIN phải là chuỗi đúng 4 chữ số.');
  assert.equal(f.calls.length,0);
 });
}
for (const [options,code] of [[{noUser:true},"UNAUTHORIZED"],[{authError:true},"UNAUTHORIZED"],[{authUserId:other},"UNAUTHORIZED"],[{noProfile:true},"PROFILE_NOT_FOUND"],[{status:"inactive"},"ACCOUNT_INACTIVE"],[{role:"seller"},"ROLE_CONFLICT"],[{role:"staff"},"ROLE_CONFLICT"],[{errorAt:"profile"},"DATABASE_ACCESS_DENIED"],[{throwAt:"profile"},"REGISTRATION_FAILED"]]) {
  test('registration session/profile rejects: '+JSON.stringify(options),async()=>{
    const f=fixture({role:"student",...options});
    await assert.rejects(f.SellerServices.register(userId,registration(),f.client),{message:code});
    assert.equal(f.writes().length,0);assert.equal(f.rpcCalls().length,0);
  });
}
test('registration calls the provided RPC once using session identity, preserves leading zero PIN, maps user.role and response allowlist',async()=>{
 const f=fixture({role:'student'});const result=await f.SellerServices.register(userId,registration(),f.client);
 assert.equal(f.rpcCalls().length,1);const call=f.rpcCalls()[0];assert.equal(call.name,'register_seller');assert.equal(call.pinPreserved,true);
 assert.deepEqual(JSON.parse(JSON.stringify(call.payload)),{p_restaurant_name:'Quán',p_description:'Mô tả',p_location:'KTX',p_operating_hours:null});
 assert.equal(f.writes().length,0);assert.equal(f.profileRole(),'seller');assert.equal(f.state.registrations.length,1);
 assert.equal(f.state.registrations[0].owner_id,userId);
 assert.equal(f.SellerServices.validateRegistration(registration()).appLockPin===testPin(),true);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{restaurant:{id:restaurantId,slug:'rpc-generated-slug',operating_status:'closed'},role:'seller',paymentSelectionPersisted:false,message:'Đăng ký thành công. Cửa hàng đang đóng; lựa chọn thanh toán chưa được lưu hoặc áp dụng.'});
 assertSafe(result);assert.equal(JSON.stringify(result).includes(testPin()),false);
});
for(const mode of ['same','daily']) {
 test('registration maps '+mode+' hours to actual RPC parameter contract',async()=>{
  const f=fixture({role:'student'});await f.SellerServices.register(userId,registration({scheduleMode:mode,openTime:'10:00',closeTime:'14:00',days:[{id:'mon',enabled:true,open:'11:00',close:'15:00'},{id:'tue',enabled:false}]}),f.client);
  assert.deepEqual(JSON.parse(JSON.stringify(f.rpcCalls()[0].payload.p_operating_hours)),{version:1,timezone:'Asia/Ho_Chi_Minh',days:{mon:mode==='same'?{open:'10:00',close:'14:00'}:{open:'11:00',close:'15:00'}}});
 });
}
test('repeat returns conflict before RPC; concurrent calls delegate to provided RPC lock semantics (mock model only)',async()=>{
 const f=fixture({role:'student'});
 const results=await Promise.allSettled([f.SellerServices.register(userId,registration(),f.client),f.SellerServices.register(userId,registration(),f.client)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'ROLE_CONFLICT');
 assert.equal(f.state.registrations.length,1);assert.equal(f.writes().length,0);
 const before=f.rpcCalls().length;await assert.rejects(f.SellerServices.register(userId,registration(),f.client),/ROLE_CONFLICT/);assert.equal(f.rpcCalls().length,before);
});
const rpcCases=[
 ['UNAUTHORIZED','UNAUTHORIZED',401],['USER_NOT_FOUND','PROFILE_NOT_FOUND',403],['ACCOUNT_INACTIVE','ACCOUNT_INACTIVE',403],
 ['ALREADY_SELLER','ROLE_CONFLICT',409],['INVALID_ROLE','ROLE_CONFLICT',409],['RESTAURANT_ALREADY_EXISTS','ROLE_CONFLICT',409],
 ['INVALID_PIN','VALIDATION_ERROR',400],['VALIDATION_ERROR','VALIDATION_ERROR',400],
];
for(const [message,code,status] of rpcCases) {
 test('API maps provided RPC business error '+message+' without raw SQL',async()=>{
  const f=fixture({role:'student',rpcError:{code:'P0001',message,details:'PRIVATE'}});const before=structuredClone(f.state);
  const response=await f.api('register')(registration());assert.equal(response.status,status);const data=await response.json();assert.equal(data.error.code,code);assertSafe(data);
  assert.deepEqual(f.state,before);assert.equal(f.profileRole(),'student');assert.equal(f.rpcCalls().length,1);assert.equal(f.writes().length,0);
 });
}
for(const [error,code,status] of [
 [{code:'42501',message:'PRIVATE'},'DATABASE_ACCESS_DENIED',403],
 [{code:'PGRST202',message:'PRIVATE'},'REGISTRATION_RPC_UNAVAILABLE',503],
 [{code:'42883',message:'PRIVATE'},'REGISTRATION_RPC_UNAVAILABLE',503],
 [{code:'23505',message:'duplicate key violates unique constraint "restaurants_slug_key"'},'SLUG_CONFLICT',409],
 [{code:'23505',message:'duplicate key violates unique constraint "unrelated_key"'},'REGISTRATION_FAILED',500],
 [{code:'XX',message:'PRIVATE'},'REGISTRATION_FAILED',500],
 [{code:'',message:'PRIVATE'},'REGISTRATION_RESULT_UNKNOWN',503],
]) {
 test('RPC infrastructure/constraint error '+code+' '+status+' never retries or falls back',async()=>{
  const f=fixture({role:'student',rpcError:error});const response=await f.api('register')(registration());assert.equal(response.status,status);const data=await response.json();assert.equal(data.error.code,code);assertSafe(data);
  assert.equal(f.rpcCalls().length,1);assert.equal(f.writes().length,0);assert.equal(f.state.registrations.length,0);
 });
}
for(const options of [{rpcNetworkError:true},{commitThenNetworkError:true},
 {rpcResponse:{}},{rpcResponse:{success:true,user:{id:other,role:'seller'},restaurant:{id:restaurantId,slug:'rpc',operating_status:'closed'}}},
 {rpcResponse:{success:true,user:{id:userId,role:'seller'},restaurant:{id:restaurantId,slug:'rpc',operating_status:'open'}}}]) {
 test('uncertain RPC outcome is surfaced without retry or compensation: '+Object.keys(options)[0],async()=>{
  const f=fixture({role:'student',...options});await assert.rejects(f.SellerServices.register(userId,registration(),f.client),/REGISTRATION_RESULT_UNKNOWN/);
  assert.equal(f.rpcCalls().length,1);assert.equal(f.writes().length,0);
 });
}
for (const [options,expected] of [[{},201],[{noUser:true},401],[{status:"inactive"},403],[{role:"seller"},409],[{errorAt:"profile"},403]]) {
  test('register API uses real service/session with safe response: '+JSON.stringify(options),async()=>{
    const f=fixture({role:"student",...options});const response=await f.api('register')(registration());
    assert.equal(response.status,expected);assert.equal(response.headers.get('Cache-Control'),'no-store');assertSafe(await response.json());assert.equal(f.writes().length,0);
  });
}
test('register API Origin, invalid JSON and missing PIN stop before RPC',async()=>{
  const f=fixture({role:"student"});const api=f.api('register');
  assert.equal((await api(registration(),{origin:'https://evil.invalid'})).status,403);assert.equal(f.calls.length,0);
  assert.equal((await api(null,{raw:'bad JSON'})).status,400);
  const input=registration();delete input.appLockPin;assert.equal((await api(input)).status,400);
  assert.equal(f.rpcCalls().length,0);assert.equal(f.writes().length,0);
});

test('installed Supabase SDK sends RPC as POST and does not retry ambiguous network/503 failures (mock fetch, no network)',async()=>{
 for(const fail of ['network','http']) {
  let rpcRequests=0;
  const sdk=createClient('https://unit.invalid','unit-test-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{
   if(new URL(url).pathname==='/rest/v1/users') return Response.json({role:'student',status:'active'});
   assert.equal(new URL(url).pathname,'/rest/v1/rpc/register_seller');
   assert.equal(init.method,'POST');rpcRequests++;
   const body=JSON.parse(init.body);assert.equal(body.p_app_lock_pin===testPin(),true);
   assert.equal(Object.hasOwn(body,'owner_id'),false);
   if(fail==='network') throw new TypeError('PRIVATE_NETWORK');
   return Response.json({code:'',message:'PRIVATE_UPSTREAM'}, {status:503});
  }}});
  sdk.auth.getUser=async()=>({data:{user:{id:userId}},error:null});
  const f=fixture({role:'student'});
  await assert.rejects(f.SellerServices.register(userId,registration(),sdk),/REGISTRATION_RESULT_UNKNOWN/);
  assert.equal(rpcRequests,1);
 }
});
