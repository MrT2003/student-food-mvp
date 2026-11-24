import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,load,userId,restaurantId} from './seller-sdk-fixture.mjs';
const contract=load('../lib/seller/shop-contract.ts');
for(const phone of ['0012345678','+84123456789',null,''])test('contact PATCH normalized '+JSON.stringify(phone),async()=>{
 const f=fixture();const before=structuredClone(f.state.restaurant);
 const result=await f.SellerServices.updateRestaurant(userId,restaurantId,{contact_phone:phone},f.client);
 assert.equal(result.restaurant.contact_phone,phone||null);assert.equal(f.state.restaurant.contact_phone,phone||null);
 assert.deepEqual(Object.keys(f.writes()[0].values).sort(),['contact_phone','updated_at']);
 for(const key of ['owner_id','slug','status','operating_status','operating_hours','avatar_url'])assert.deepEqual(f.state.restaurant[key],before[key]);
 assert.ok(f.calls.every(call=>call.table!=='users'||call.mode==='select'));
});
for(const phone of [1234567890,undefined,[],{},true,'1','0'.repeat(16),'01234abc89','01 23456789'])test('reject invalid contact before SDK '+String(phone),async()=>{
 const f=fixture();await assert.rejects(f.SellerServices.updateRestaurant(userId,restaurantId,{contact_phone:phone},f.client),/SELLER_VALIDATION_ERROR/);assert.equal(f.calls.length,0);
});
test('omitted phone preserved, unavailable column is controlled, not a fallback to account phone',async()=>{
 const f=fixture();f.state.restaurant.contact_phone='0012345678';await f.SellerServices.updateRestaurant(userId,restaurantId,{name:'NEW'},f.client);assert.equal(f.state.restaurant.contact_phone,'0012345678');
 const missing=fixture({errorAt:'write',error:{code:'42703',message:'PRIVATE'}});const res=await missing.api('restaurant')({contact_phone:'0012345678'});assert.equal(res.status,503);assert.equal((await res.json()).error.code,'CONTACT_PHONE_UNAVAILABLE');
});
for(const options of [{noUser:true},{notOwner:true},{role:'staff'},{status:'inactive'}])test('contact ownership and auth '+JSON.stringify(options),async()=>{
 const f=fixture(options);await assert.rejects(f.SellerServices.updateRestaurant(userId,restaurantId,{contact_phone:'0012345678'},f.client));assert.equal(f.writes().length,0);
});
test('public link is one encoded saved segment with actual deployment origin',()=>{
 assert.equal(contract.restaurantPath('quan-a'),'/restaurants/quan-a');
 assert.equal(contract.restaurantUrl('quán A','https://food.example:8443'), 'https://food.example:8443/restaurants/qu%C3%A1n%20A');
 for(const slug of [undefined,null,'',' ','../other','a/b','..','a\\b'])assert.equal(contract.restaurantPath(slug),null);
 assert.equal(contract.restaurantUrl('a','javascript:evil'),null);
});


test('seller access reads shop contact separately, old schema keeps avatar/access working',async()=>{
 const services=load('../services/seller-access.service.ts');
 for(const code of [null,'42703','PGRST204']){
  const columns=[];const shop={id:restaurantId,name:'TEST',slug:'test',avatar_url:'https://example.invalid/a.png',operating_status:'closed',status:'active',contact_phone:'0012345678'};
  const client={auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},from(table){return {
   select(value){columns.push(value);return this;},eq(){return this;},limit:async()=>({data:[shop],error:null}),
   maybeSingle:async()=>table==='users'?{data:{id:userId,role:'seller',status:'active',work_for_restaurant_id:null},error:null}:code?{data:null,error:{code}}:{data:{contact_phone:shop.contact_phone},error:null},
  };}};
  const result=await services.SellerAccessServices.read(client);assert.equal(result.restaurant.avatar_url,shop.avatar_url);assert.equal(result.restaurant.contact_phone,code?null:shop.contact_phone);assert.equal(result.restaurant.contact_phone_available,!code);assert.ok(columns.includes('contact_phone'));
 }
});
test('uncertain contact save reconciles through owned access with no mutation retry',async()=>{
 for(const matches of [true,false]){
  let writes=0,reads=0,invalidations=0;
  const client=load('../lib/seller/management-client.ts',{
   '@/store/useAuthStore':{useAuthStore:{getState:()=>({user:{id:userId,role:'seller',status:'active'}})}},
   './access-client':{invalidateSellerAccess:()=>invalidations++,readSellerAccess:async()=>{reads++;return {user:{id:userId,role:'seller',status:'active'},restaurant:{id:restaurantId,name:'TEST',contact_phone_available:true,contact_phone:matches?'0012345678':null}};}},
  },{fetch:async()=>{writes++;throw Error('network');}});
  if(matches)assert.equal((await client.updateSellerRestaurant(userId,restaurantId,{contact_phone:'0012345678'})).restaurant.contact_phone,'0012345678');
  else await assert.rejects(client.updateSellerRestaurant(userId,restaurantId,{contact_phone:'0012345678'}));
  assert.equal(writes,1);assert.equal(reads,1);assert.equal(invalidations,matches?1:0);
 }
});


test('phone timeout aborts write, clears timer and reads owned data without replay',async()=>{
 let abort,cleared=0,writes=0,reads=0;
 const client=load('../lib/seller/management-client.ts',{
  '@/store/useAuthStore':{useAuthStore:{getState:()=>({user:{id:userId,role:'seller',status:'active'}})}},
  './access-client':{invalidateSellerAccess(){},readSellerAccess:async()=>{reads++;return {user:{id:userId,role:'seller',status:'active'},restaurant:{id:restaurantId,name:'TEST',contact_phone_available:true,contact_phone:'0012345678'}};}},
 },{setTimeout(fn,ms){assert.equal(ms,15000);abort=fn;return 1;},clearTimeout(){cleared++;},fetch:async(path,request)=>{writes++;return new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(Error('timeout'))));}});
 const pending=client.updateSellerRestaurant(userId,restaurantId,{contact_phone:'0012345678'});await new Promise(resolve=>setImmediate(resolve));abort();
 assert.equal((await pending).restaurant.contact_phone,'0012345678');assert.equal(writes,1);assert.equal(reads,1);assert.equal(cleared,1);
});


test('PATCH returns exact safe field for validation and never maps DB failures to VALIDATION_ERROR',async()=>{
 const f=fixture();const invalid=await f.api('restaurant')({contact_phone:1234567890});assert.equal(invalid.status,400);assert.equal((await invalid.json()).error.field,'contact_phone');assert.equal(f.writes().length,0);
 const failing=fixture({errorAt:'write',error:{code:'23514',message:'PRIVATE_TRIGGER'}});const response=await failing.api('restaurant')({contact_phone:'0123456789'});assert.equal(response.status,500);assert.equal((await response.json()).error.code,'UPDATE_FAILED');
});
