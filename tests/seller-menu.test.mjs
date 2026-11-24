import assert from 'node:assert/strict';
import {test} from 'node:test';
import {create} from 'zustand';
import {load,userId,restaurantId,other} from './seller-sdk-fixture.mjs';
const c=load('../lib/seller/menu-contract.ts',{}, {URL});
const groupId='33333333-3333-4333-8333-333333333333';
const optionId='55555555-5555-4555-8555-555555555555';
const version='2026-11-06T00:00:00.123456+00:00';
const payload=()=>({name:' Test ',description:null,category:'Cơm',image_url:'https://example.invalid/image.png',price:12.34,is_active:true,is_available:true,
 groups:[{id:groupId,name:'Group',is_active:true,is_multiple:false,is_required:true,options:[{id:optionId,option_name:'Option',additional_price:0.05,is_active:true}]}]});
for(const input of [null,[],{}, {...payload(),owner_id:userId},{...payload(),price:'1'},{...payload(),price:NaN},{...payload(),price:Infinity},{...payload(),price:1.234},{...payload(),price:-1},{...payload(),price:10000001},{...payload(),name:' '},{...payload(),name:'a'.repeat(121)},{...payload(),is_active:'true'}, {...payload(),groups:[{...payload().groups[0],options:[]}]}, {...payload(),groups:Array(21).fill(payload().groups[0])}, {...payload(),groups:[{...payload().groups[0],options:Array(51).fill(payload().groups[0].options[0])}]}])test('runtime menu validation rejects invalid contract '+String([null,[]].includes(input)?input:typeof input),()=>assert.throws(()=>c.validateMenu(input,false),{code:'VALIDATION_ERROR'}));
test('validation preserves cents, immutable version, active children and rejects forged nested relations/IDs',()=>{
 const valid=c.validateMenu(payload(),false);assert.equal(valid.payload.name,'Test');assert.equal(valid.payload.price,12.34);
 assert.equal(c.validateMenu({is_available:false,expected_updated_at:version},true).expected,version);
 for(const field of ['owner_id','restaurant_id','created_at','slug'])assert.throws(()=>c.validateMenu({...payload(),[field]:'forged'},false));
 const p=payload();p.groups.push({...p.groups[0]});assert.throws(()=>c.validateMenu(p,false));
 p.groups.pop();p.groups[0].options.push({...p.groups[0].options[0]});assert.throws(()=>c.validateMenu(p,false));
});
function fixture(options={}){
 const calls=[];
 const client={auth:{getUser:async()=>({data:{user:options.noAuth?null:{id:userId}},error:null})},from(table){const filters=[];calls.push({table,filters});return {select(){return this;},eq(k,v){filters.push([k,v]);return this;},async maybeSingle(){return {data:table==='users'?{role:options.role??'seller',status:options.status??'active'}:options.notOwner?null:{id:restaurantId},error:options.dbError?{message:'PRIVATE'}:null};}};},async rpc(name,args){calls.push({name,args});if(options.throw)throw Error('PRIVATE');return {data:options.response??{item:{id:options.itemId??other,restaurant_id:restaurantId,updated_at:version}},error:options.rpcError??null};}};
 const service=load('../services/seller-menu.service.ts',{'@/lib/seller/menu-contract':c});
 return {client,calls,...service};
}
for(const options of [{noAuth:true},{role:'staff'},{role:'student'},{status:'inactive'},{notOwner:true},{dbError:true}])test('write denies invalid identity/ownership before RPC '+JSON.stringify(options),async()=>{
 const f=fixture(options);await assert.rejects(f.SellerMenuServices.write(f.client,restaurantId,undefined,payload()));assert.equal(f.calls.some(x=>x.name),false);
});
test('service dispatches exactly one session RPC, preserves IDs/version and sends minimal toggle',async()=>{
 const f=fixture();await f.SellerMenuServices.write(f.client,restaurantId,undefined,payload());assert.equal(f.calls.filter(x=>x.name).length,1);assert.equal(f.calls.at(-1).name,'sf_manage_menu');assert.equal(f.calls.at(-1).args.p_payload.groups[0].id,groupId);
 await f.SellerMenuServices.write(f.client,restaurantId,other,{expected_updated_at:version,is_active:false});assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1).args.p_payload)),{is_active:false});assert.equal(f.calls.at(-1).args.p_expected_updated_at,version);
});
for(const [error,code] of [[{code:'PGRST202',message:'PRIVATE'},'MENU_RPC_UNAVAILABLE'],[{code:'42883',message:'PRIVATE'},'MENU_RPC_DEPENDENCY_FAILED'],[{code:'42501',message:'PRIVATE'},'MENU_FORBIDDEN'],[{code:'23505',message:'PRIVATE'},'MENU_WRITE_CONFLICT'],[{code:'23505',message:'duplicate constraint "uq_menu_item_option_group_name"'},'MENU_NAME_CONFLICT'],[{code:'23505',message:'duplicate constraint "menu_items_slug_key"'},'MENU_SLUG_CONFLICT'],[{message:'MENU_STALE'},'MENU_STALE'],[{message:'MENU_FORBIDDEN'},'MENU_FORBIDDEN'],[{message:'MENU_NOT_FOUND'},'MENU_NOT_FOUND'],[{message:'PRIVATE'},'MENU_RESULT_UNKNOWN']])test('safe RPC error and no retry '+code,async()=>{
 const f=fixture({rpcError:error});await assert.rejects(f.SellerMenuServices.write(f.client,restaurantId,undefined,payload()),{code});assert.equal(f.calls.filter(x=>x.name).length,1);
});
test('API uses Auth/Origin and rejects malformed/oversized body before mutation',async()=>{
 let writes=0;const f=fixture();const http=load('../lib/seller/menu-http.ts',{'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},'@/lib/supabase/server':{createClient:async()=>f.client},'./menu-contract':c,'@/services/seller-menu.service':{SellerMenuServices:{write:async()=>{writes++;return {};}}}},{TextDecoder});
 const send=(body,origin='http://localhost:3000')=>http.menuRequest(new Request('http://localhost:3000/api',{method:'POST',headers:{origin},body}),Promise.resolve({restaurantId}),true);
 assert.equal((await send('{')).status,400);assert.equal((await send('x'.repeat(131073))).status,413);assert.equal((await send('{}','https://outside.invalid')).status,403);assert.equal(writes,0);
});
test('actual store waits for API, retains rows on errors, soft-deletes only with PATCH, ignores old identity',async()=>{
 let user={id:userId,role:'seller',status:'active'},listener,respond;
 const auth={getState:()=>({user}),subscribe:fn=>{listener=fn;}};
 const row={item:{...payload(),id:other,restaurant_id:restaurantId,slug:'kept',created_at:version,updated_at:version},optionGroups:[],optionCount:0};delete row.item.groups;
 const requests=[];
 const {useSellerMenuStore:store}=load('../store/useSellerMenuStore.ts',{'zustand':{create},'@/store/useAuthStore':{useAuthStore:auth},'@/lib/seller/menu-contract':c},{AbortController,setTimeout,clearTimeout,fetch:async(url,request)=>{requests.push({url,request});return new Promise(resolve=>{respond=resolve;});}});
 store.setState({restaurantId,rows:[row]});const write=store.getState().deleteMenuItem(other);assert.equal(store.getState().rows[0].item.is_active,true);assert.equal(requests[0].request.method,'PATCH');assert.deepEqual(JSON.parse(requests[0].request.body),{is_active:false,expected_updated_at:version});
 respond(Response.json({error:{code:'MENU_STALE'}},{status:409}));await assert.rejects(write);assert.equal(store.getState().rows[0].item.is_active,true);assert.equal(store.getState().busy,false);
 const late=store.getState().deleteMenuItem(other);const previous={user};user={...user,id:optionId};listener({user},previous);respond(Response.json({item:{...row.item,is_active:false,option_groups:[]}}));await assert.rejects(late);assert.equal(store.getState().rows.length,0);
});

test('service response allowlists item and child fields',async()=>{
 const f=fixture({response:{item:{id:other,restaurant_id:restaurantId,updated_at:version,internal:'PRIVATE',option_groups:[{id:groupId,internal:'PRIVATE',options:[{id:optionId,internal:'PRIVATE'}]}]}}});
 const result=await f.SellerMenuServices.write(f.client,restaurantId,undefined,payload());assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});

test('price precision rejects tiny fractions instead of silently accepting a SQL-rejected value',()=>{
 for(const price of [0.0000000001,1.0000000001,12.345])assert.throws(()=>c.validateMenu({...payload(),price},false),{code:'VALIDATION_ERROR'});
 for(const price of [0,0.01,12.34,10000000])assert.equal(c.validateMenu({...payload(),price},false).payload.price,price);
});
