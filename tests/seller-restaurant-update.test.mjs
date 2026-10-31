import assert from "node:assert/strict";
import { test } from "node:test";
import {fixture,userId,restaurantId,other,assertSafe} from './seller-sdk-fixture.mjs';

for(const patch of [{name:' Tên mới '},{description:' Mô tả mới '},{location:' KTX B '},{name:'Mới',description:'Mới',location:'KTX A'}]) {
 test('SDK PATCH keeps omitted fields and owner/slug/status: '+JSON.stringify(patch),async()=>{
  const f=fixture();const before=structuredClone(f.state.restaurant);
  const result=await f.SellerServices.updateRestaurant(userId,restaurantId,patch,f.client);
  assert.equal(f.writes().length,1);const write=f.writes()[0];
  assert.deepEqual(Object.keys(write.values).sort(),[...Object.keys(patch),'updated_at'].sort());
  assert.deepEqual(write.filters, [['id',restaurantId,'eq'],['owner_id',userId,'eq']]);
  for(const field of ['name','description','location','operating_hours','slug','status','operating_status','owner_id']) assert.deepEqual(f.state.restaurant[field],Object.hasOwn(patch,field)?patch[field].trim():before[field]);
  assertSafe(result);assert.deepEqual(Object.keys(result.restaurant).sort(),['id','name','description','location','operating_hours'].sort());
 });
}
for(const [schedule,hours] of [[{mode:'later'},null],[{mode:'same',dayIds:['mon','fri'],openTime:'10:00',closeTime:'14:00'},{mon:{open:'10:00',close:'14:00'},fri:{open:'10:00',close:'14:00'}}],[{mode:'daily',days:[{id:'mon',open:'09:00',close:'13:00'},{id:'fri',open:'10:00',close:'15:00'}]},{mon:{open:'09:00',close:'13:00'},fri:{open:'10:00',close:'15:00'}}]]) {
 test('SDK schedule maps '+schedule.mode,async()=>{
  const f=fixture();await f.SellerServices.updateRestaurant(userId,restaurantId,{schedule},f.client);
  assert.deepEqual(JSON.parse(JSON.stringify(f.state.restaurant.operating_hours)),hours===null?null:{version:1,timezone:'Asia/Ho_Chi_Minh',days:hours});
  assert.equal(f.state.restaurant.slug,'original-slug');assert.equal(f.state.restaurant.operating_status,'paused');
 });
}
for(const input of [null,[],{}, {owner_id:other},{name:' '},{name:'x'.repeat(101)},{schedule:null},{schedule:{mode:'same',dayIds:['mon'],openTime:'14:00',closeTime:'10:00'}}]) {
 test('invalid restaurant PATCH before SDK: '+JSON.stringify(input),async()=>{
  const f=fixture();await assert.rejects(f.SellerServices.updateRestaurant(userId,restaurantId,input,f.client),/SELLER_VALIDATION_ERROR/);assert.equal(f.calls.length,0);
 });
}
for(const [options,code] of [[{noUser:true},'UNAUTHORIZED'],[{authUserId:other},'UNAUTHORIZED'],[{noProfile:true},'PROFILE_NOT_FOUND'],[{status:'inactive'},'ACCOUNT_INACTIVE'],[{role:'student'},'SELLER_REQUIRED'],[{role:'staff'},'SELLER_REQUIRED'],[{notOwner:true},'RESTAURANT_NOT_FOUND'],[{noRestaurant:true},'RESTAURANT_NOT_FOUND'],[{hiddenUpdate:true},'RESTAURANT_NOT_FOUND'],[{errorAt:'write'},'DATABASE_ACCESS_DENIED'],[{errorAt:'write',error:{code:'XX',message:'PRIVATE'}},'UPDATE_FAILED'],[{throwAt:'write'},'UPDATE_FAILED']]) {
 test('SDK restaurant permission/error '+JSON.stringify(options),async()=>{
  const f=fixture(options);const before=structuredClone(f.state);
  await assert.rejects(f.SellerServices.updateRestaurant(userId,restaurantId,{name:'New'},f.client),{message:code});assert.deepEqual(f.state,before);
 });
}
test('restaurant API uses SDK and sanitized failure mapping',async()=>{
 for(const [options,status] of [[{},200],[{noUser:true},401],[{notOwner:true},404],[{errorAt:'write'},403],[{throwAt:'write'},500]]) {
  const f=fixture(options);const response=await f.api('restaurant')({name:'Mới'});assert.equal(response.status,status);assertSafe(await response.json());
 }
 const f=fixture();const api=f.api('restaurant');assert.equal((await api({name:'Mới'},{origin:'https://evil.invalid'})).status,403);assert.equal(f.calls.length,0);
 assert.equal((await api(null,{raw:'bad JSON'})).status,400);assert.equal(f.writes().length,0);
});
