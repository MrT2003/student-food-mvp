import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,userId,restaurantId,bankId,other,assertSafe} from './seller-sdk-fixture.mjs';
const input=(patch={})=>({bank_name:' TEST BANK ',account_no:' 0012345 ',account_name:' TEST ONLY ',...patch});
const call=(f,mode,data,rid=restaurantId,bid=bankId)=>mode==='create'?f.SellerServices.createRestaurantBank(userId,rid,data,f.client):f.SellerServices.updateRestaurantBank(userId,rid,bid,data,f.client);
test('GET banks verifies seller/owner, paginates even below requested size, and returns an allowlist',async()=>{
 const f=fixture({readPageSize:1});
 f.state.banks.push({...f.state.banks[0],id:'66666666-6666-4666-8666-666666666666',account_no:'00099',unexpected:'PRIVATE'});
 const result=await f.SellerServices.listRestaurantBanks(userId,restaurantId,f.client);
 assert.equal(result.banks.length,2);assertSafe(result);assert.equal(f.writes().length,0);
 assert.ok(result.banks.every(bank=>bank.restaurant_id===restaurantId));
 assert.deepEqual(Object.keys(result.banks[0]).sort(),['id','restaurant_id','bank_name','account_no','account_name','is_default'].sort());
 assert.deepEqual(f.calls.filter(c=>c.range).map(c=>c.range),[[0,99],[1,100],[2,101]]);
});
// Service rejects an actor argument different from Auth. API uses Auth's actual actor;
// that other authenticated seller instead reaches the owner check and receives 404.
for(const [options,code,status] of [[{noUser:true},'UNAUTHORIZED',401],[{authUserId:other},'UNAUTHORIZED',404],[{noProfile:true},'PROFILE_NOT_FOUND',403],[{status:'inactive'},'ACCOUNT_INACTIVE',403],[{role:'staff'},'SELLER_REQUIRED',403],[{role:'student'},'SELLER_REQUIRED',403],[{notOwner:true},'RESTAURANT_NOT_FOUND',404],[{noRestaurant:true},'RESTAURANT_NOT_FOUND',404],[{errorAt:'list'},'DATABASE_ACCESS_DENIED',403],[{throwAt:'list'},'BANK_READ_FAILED',500]]) {
 test('GET banks access/error '+JSON.stringify(options),async()=>{
  const f=fixture(options);await assert.rejects(f.SellerServices.listRestaurantBanks(userId,restaurantId,f.client),{message:code});
  const response=await f.api('read')();assert.equal(response.status,status);assertSafe(await response.json());assert.equal(f.writes().length,0);
 });
}
test('GET banks empty list and invalid UUID',async()=>{
 const f=fixture();f.state.banks=[];
 const response=await f.api('read')();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{banks:[]});
 const invalid=fixture();assert.equal((await invalid.api('read')(null,{restaurantId:'bad'})).status,400);assert.equal(invalid.writes().length,0);
});
for(const mode of ['create','update']) {
 test(mode+' SDK bank ownership, string and partial patch',async()=>{
  const f=fixture({targetDefault:mode==='update'});const before=structuredClone(f.state.banks[0]);
  const result=await call(f,mode,mode==='create'?input():{account_name:' NEW NAME '});
  assert.equal(f.writes().length,1);assertSafe(result);
  if(mode==='create'){assert.equal(result.bank.account_no,'0012345');assert.equal(result.bank.is_default,false);assert.equal(result.bank.restaurant_id,restaurantId);}
  else{assert.equal(result.bank.account_no,before.account_no);assert.equal(result.bank.is_default,true);assert.deepEqual(Object.keys(f.writes()[0].values).sort(),['account_name','updated_at']);}
  assert.equal(f.state.banks.find(b=>b.restaurant_id===other).is_default,true);
 });
 test(mode+' default true may be set using one row when no other default exists',async()=>{
  const f=fixture();const result=await call(f,mode,mode==='create'?input({is_default:true}):{is_default:true});
  assert.equal(result.bank.is_default,true);assert.equal(f.writes().length,1);
 });
 test(mode+' cannot transfer default with unverified RPC: no demotion or partial write',async()=>{
  const f=fixture({otherDefault:true});const before=structuredClone(f.state);
  await assert.rejects(call(f,mode,mode==='create'?input({is_default:true}):{is_default:true}),/BANK_DEFAULT_ATOMICITY_UNAVAILABLE/);
  assert.equal(f.writes().length,0);assert.deepEqual(f.state,before);
 });
 for(const [options,code] of [[{noUser:true},'UNAUTHORIZED'],[{authUserId:other},'UNAUTHORIZED'],[{noProfile:true},'PROFILE_NOT_FOUND'],[{status:'inactive'},'ACCOUNT_INACTIVE'],[{role:'student'},'SELLER_REQUIRED'],[{role:'staff'},'SELLER_REQUIRED'],[{notOwner:true},'RESTAURANT_NOT_FOUND'],[{errorAt:'write'},'DATABASE_ACCESS_DENIED'],[{throwAt:'write'},'BANK_WRITE_FAILED']]) {
  test(mode+' bank permission/error '+JSON.stringify(options),async()=>{
   const f=fixture(options);const before=structuredClone(f.state);await assert.rejects(call(f,mode,mode==='create'?input():{account_name:'NEW'}),{message:code});assert.deepEqual(f.state,before);
  });
 }
 for(const body of [null,[],{}, {role:'seller'}, {account_no:123},{account_no:null},{account_no:' '},{is_default:'true'}]) {
  test(mode+' bank validation '+JSON.stringify(body),async()=>{
   const f=fixture();await assert.rejects(call(f,mode,body),/SELLER_VALIDATION_ERROR/);assert.equal(f.calls.length,0);
  });
 }
 for(const [constraint,code] of [['uq_restaurant_banks_account','BANK_ACCOUNT_CONFLICT'],['uq_restaurant_banks_one_default','BANK_DEFAULT_ATOMICITY_UNAVAILABLE'],['restaurant_banks_pkey','BANK_WRITE_FAILED']]) {
  test(mode+' maps exact PostgREST constraint '+constraint,async()=>{
   const f=fixture({errorAt:'write',error:{code:'23505',message:'duplicate key violates unique constraint "'+constraint+'"'}});
   const before=structuredClone(f.state);await assert.rejects(call(f,mode,mode==='create'?input():{account_name:'NEW'}),{message:code});assert.deepEqual(f.state,before);
  });
 }
}
test('bank PATCH wrong restaurant and zero affected row do not change default',async()=>{
 for(const options of [{},{hiddenUpdate:true}]) {
  const f=fixture({...options,targetDefault:true});const before=structuredClone(f.state);
  await assert.rejects(call(f,'update',{is_default:false},restaurantId,options.hiddenUpdate?bankId:other),/BANK_NOT_FOUND/);assert.deepEqual(f.state,before);
 }
});
test('bank false leaves no default; omitted flag does not demote; default-target true can be retained',async()=>{
 const f=fixture({targetDefault:true});await call(f,'update',{is_default:true,account_name:'NAME'});assert.equal(f.state.banks[0].is_default,true);
 await call(f,'update',{is_default:false});assert.equal(f.state.banks.filter(b=>b.restaurant_id===restaurantId&&b.is_default).length,0);
});
test('duplicate account error is scoped to restaurant and never upserts',async()=>{
 const f=fixture();const before=structuredClone(f.state);await assert.rejects(call(f,'create',input({account_no:'001234'})),/BANK_ACCOUNT_CONFLICT/);assert.deepEqual(f.state,before);
 const result=await call(f,'create',input({account_no:'0099'}));assert.equal(result.bank.account_no,'0099');
});
test('two initial defaults race: simulated unique permits only one; no demote or compensation (mock)',async()=>{
 const f=fixture();const results=await Promise.allSettled([call(f,'create',input({account_no:'001',is_default:true})),call(f,'create',input({account_no:'002',is_default:true}))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.state.banks.filter(b=>b.restaurant_id===restaurantId&&b.is_default).length,1);
});
test('banks API real SDK service, session, safe RLS errors and blocked transfer',async()=>{
 for(const [options,status] of [[{},201],[{noUser:true},401],[{notOwner:true},404],[{errorAt:'write'},403],[{otherDefault:true},503]]) {
  const f=fixture(options);const response=await f.api('create')(input({is_default:!!options.otherDefault}));assert.equal(response.status,status);assertSafe(await response.json());
 }
 const f=fixture();assert.equal((await f.api('update')({account_name:'NEW'},{bankId:other})).status,404);
 assert.equal((await f.api('create')(input(),{origin:'https://evil.invalid'})).status,403);
 assert.equal((await f.api('create')(null,{raw:'bad JSON'})).status,400);
});

test('bank required fields, runtime types, identity fields and invalid UUIDs reject before SDK',async()=>{
 for(const field of ['bank_name','account_no','account_name']) {
  const f=fixture();const body=input();delete body[field];
  await assert.rejects(call(f,'create',body),/SELLER_VALIDATION_ERROR/);
  for(const value of [null,123,[],{},true,'  ']) await assert.rejects(call(f,'update',{[field]:value}),/SELLER_VALIDATION_ERROR/);
  assert.equal(f.calls.length,0);
 }
 const f=fixture();
 for(const field of ['id','owner_id','user_id','restaurant_id','created_at','updated_at']) await assert.rejects(call(f,'create',input({[field]:other})),/SELLER_VALIDATION_ERROR/);
 for(const id of [null,123,'invalid']) {
  await assert.rejects(call(f,'create',input(),id),/SELLER_VALIDATION_ERROR/);
  await assert.rejects(call(f,'update',{is_default:false},restaurantId,id),/SELLER_VALIDATION_ERROR/);
 }
 assert.equal(f.calls.length,0);
 const data=f.SellerServices.validateBankCreate(input({bank_name:'x'.repeat(2000),account_no:'001 2-3'}));
 assert.equal(data.bank_name.length,2000);assert.equal(data.account_no,'001 2-3');
});
test('bank only maps exact table/schema constraint; failed insert/default never mutates existing defaults (mock)',async()=>{
 for(const error of [{code:'23505',constraint:'uq_restaurant_banks_account',schema:'other'},{code:'23505',constraint:'uq_restaurant_banks_account',table:'users'},{code:'23505',message:'PRIVATE unrelated unique'}]){
  const f=fixture({errorAt:'write',error});const before=structuredClone(f.state);
  await assert.rejects(call(f,'create',input({is_default:true})),/BANK_WRITE_FAILED/);assert.deepEqual(f.state,before);
 }
 const f=fixture({hiddenUpdate:true});const before=structuredClone(f.state);await assert.rejects(call(f,'create',input({is_default:true})),/BANK_WRITE_FAILED/);assert.deepEqual(f.state,before);
});
