import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";
import * as qrcode from "qrcode";
import jsQR from "jsqr";
import pngjs from "pngjs";

const secret = "test-only-key-32-bytes-minimum-123456789";
const seller = "11111111-1111-4111-8111-111111111111";
const student = "22222222-2222-4222-8222-222222222222";
const restaurant = "44444444-4444-4444-8444-444444444444";
function clock() {
  let time = 1900000000000;
  return { Date: class extends Date { static now() { return time; } }, advance(ms) { time += ms; } };
}
function load(file, mocks = {}, globals = {}) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const noLog = () => { throw new Error("Must not log token/secret"); };
  vm.runInNewContext(output, { exports, Buffer, URL, console: { error: noLog, log: noLog, warn: noLog },
    require(id) {
      if (id === "server-only") return {};
      if (id === "@/lib/http/request-origin") return load("../lib/http/request-origin.ts");
      if (id === "node:crypto") return crypto;
      if (id in mocks) return mocks[id];
      if (id === "qrcode") return qrcode;
      if (id === "@/utilities/system.utility") return load("../utilities/system.utility.ts");
      throw new Error(`Unexpected import: ${id}`);
    }, ...globals });
  return exports;
}
function tokenTools(c = clock(), env = { STAFF_INVITATION_SECRET: secret }) {
  return { ...load("../lib/seller/staff-token.ts", {}, { Date: c.Date, process: { env } }), clock: c };
}
function signed(claims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${crypto.createHmac("sha256", secret).update(`studentfood.staff-invite:v1:${payload}`).digest("base64url")}`;
}
function claims(token) { return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()); }

test("real HMAC claims have fixed lifetime/purpose, fresh nonce; old QR keeps its expiry", () => {
  const t = tokenTools();
  const first = t.issueStaffToken(restaurant, seller);
  const again = t.issueStaffToken(restaurant, seller);
  assert.notEqual(first.token, again.token);
  assert.notEqual(claims(first.token).nonce, claims(again.token).nonce);
  assert.equal(claims(first.token).exp - claims(first.token).iat, 300);
  assert.equal(t.verifyStaffToken(first.token).restaurantId, restaurant);
  t.clock.advance(299000);
  const fresh = t.issueStaffToken(restaurant, seller);
  t.clock.advance(1000);
  assert.throws(() => t.verifyStaffToken(first.token), /STAFF_TOKEN_EXPIRED/);
  assert.equal(t.verifyStaffToken(fresh.token).restaurantId, restaurant);
});
test("token tampering, noncanonical signature, wrong purpose/version/structure and future iat rejected", () => {
  const t = tokenTools(); const original = t.issueStaffToken(restaurant, seller).token;
  for (const token of [undefined, null, 1, "", "invalid", `${original}.extra`, `${original}=`, `${original.slice(0, -1)}!`, original.replace(".", "x.")]) {
    assert.throws(() => t.verifyStaffToken(token), /INVALID_STAFF_TOKEN/);
  }
  const base = claims(original);
  for (const patch of [{ purpose: "other" }, { version: 2 }, { restaurantId: "bad" }, { issuedBy: "bad" },
    { nonce: "short" }, { exp: base.exp + 1 }, { iat: base.iat + 1, exp: base.exp + 1 },
    { exp: "later" }, { extra: true }, { iat: null }]) {
    assert.throws(() => t.verifyStaffToken(signed({ ...base, ...patch })), /INVALID_STAFF_TOKEN/);
  }
  assert.throws(() => t.verifyStaffToken(signed(null)), /INVALID_STAFF_TOKEN/);
  assert.throws(() => t.verifyStaffToken(`eA.${crypto.createHmac("sha256", secret).update("studentfood.staff-invite:v1:eA").digest("base64url")}`), /INVALID_STAFF_TOKEN/);
});
for (const key of [undefined, "", "short", "a".repeat(64), "REPLACE_WITH_A_RANDOM_SERVER_ONLY_KEY_AT_LEAST_32_BYTES"]) {
  test(`dedicated signing config rejected case ${[undefined, "", "short", "a".repeat(64), "REPLACE_WITH_A_RANDOM_SERVER_ONLY_KEY_AT_LEAST_32_BYTES"].indexOf(key)}`, () => {
    const t = tokenTools(clock(), { STAFF_INVITATION_SECRET: key });
    assert.throws(() => t.issueStaffToken(restaurant, seller), /STAFF_TOKEN_CONFIGURATION_MISSING/);
  });
}

function fixture(options={}) {
 const t=tokenTools(),calls=[];const actor=options.actor??seller;let role=options.role??'student',work=options.work??null;
 const client={async rpc(name,args){calls.push({rpc:name,hasOnlyToken:Object.keys(args).join(',')==='p_token'});if(options.network)throw Error('PRIVATE');if(options.rpcError)return {data:null,error:options.rpcError};if(work!==null)return {data:null,error:{code:'P0001',message:'STAFF_MEMBERSHIP_CONFLICT'}};role='staff';work=restaurant;return {data:{profile:{id:options.wrongResponse?'other':actor,role,work_for_restaurant_id:work,app_lock_pin:'PRIVATE'}},error:null};},auth:{async getUser(){return {data:{user:options.noAuth?null:{id:actor}},error:null};}},from(table){const filters=[];return {select(fields){calls.push({table,fields,filters});return this;},eq(k,v){filters.push([k,v]);return this;},async maybeSingle(){
 if(options.dbError)return {data:null,error:{message:'PRIVATE',code:'42501'}};
 if(table==='restaurants')return {data:options.notOwner?null:{id:restaurant},error:null};
 const id=filters.find(([k])=>k==='id')?.[1];if(options.missing)return {data:null,error:null};
 return {data:id===seller?{role:options.issuerRole??'seller',status:options.issuerStatus??'active'}:{role,status:options.status??'active',work_for_restaurant_id:work},error:null};
 }}}};
 const exports=load('../services/seller.service.ts',{'@/lib/seller/staff-token':t},{Date:t.clock.Date});
 return {...exports,t,client,calls};
}
test('SDK invitation uses session and owner, returns real decodable local PNG',async()=>{
 const f=fixture();const data=await f.SellerServices.createStaffInvitation(seller,restaurant,{},f.client);
 const png=pngjs.PNG.sync.read(Buffer.from(data.qrImageDataUrl.split(',')[1],'base64'));
 const decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
 assert.equal(decoded.data===data.qrPayload,true);const payload=JSON.parse(decoded.data);
 assert.equal(payload.token===data.token,true);assert.equal(f.t.verifyStaffToken(payload.token).restaurantId,restaurant);
 assert.equal(f.calls[1].filters.some(([k,v])=>k==='owner_id'&&v===seller),true);
 assert.equal(f.calls.some(c=>c.filters.some(([k])=>['status','operating_status'].includes(k))),false);
});
for(const [options,code] of [[{noAuth:true},'UNAUTHORIZED'],[{missing:true},'PROFILE_NOT_FOUND'],[{issuerStatus:'inactive'},'ACCOUNT_INACTIVE'],[{issuerRole:'staff'},'SELLER_REQUIRED'],[{notOwner:true},'RESTAURANT_NOT_FOUND'],[{dbError:true},'DATABASE_ACCESS_DENIED']])test('invitation safe denial '+code,async()=>{const f=fixture(options);await assert.rejects(f.SellerServices.createStaffInvitation(seller,restaurant,{},f.client),{code});});
for(const input of [null,[],{ttl:300},{owner_id:seller}])test('invitation rejects client control '+JSON.stringify(Object.keys(input??{})),async()=>{const f=fixture();await assert.rejects(f.SellerServices.createStaffInvitation(seller,restaurant,input,f.client),f.SellerValidationError);assert.equal(f.calls.length,0);});
for(const [options,code] of [[{noAuth:true},'UNAUTHORIZED'],[{status:'inactive'},'ACCOUNT_INACTIVE'],[{role:'seller'},'STAFF_ROLE_CONFLICT'],[{work:restaurant},'STAFF_MEMBERSHIP_CONFLICT'],[{issuerRole:'student'},'ISSUER_NOT_ALLOWED'],[{issuerStatus:'inactive'},'ISSUER_NOT_ALLOWED'],[{notOwner:true},'RESTAURANT_NOT_FOUND'],[{dbError:true},'DATABASE_ACCESS_DENIED']])test('join precheck denial: '+code,async()=>{const f=fixture({...options,actor:student});const token=f.t.issueStaffToken(restaurant,seller).token;await assert.rejects(f.SellerServices.joinStaff(student,{token},f.client),{code});});
test('session RPC maps allowlisted success and no supplemental mutation',async()=>{const f=fixture({actor:student});const token=f.t.issueStaffToken(restaurant,seller).token;const result=await f.SellerServices.joinStaff(student,{token},f.client);assert.equal(result.profile.role,'staff');assert.equal(Object.keys(result.profile).sort().join(','),'id,role,work_for_restaurant_id');assert.equal(f.calls.filter(c=>c.rpc).length,1);assert.equal(f.calls.find(c=>c.rpc).rpc,'join_staff_qr');assert.equal(f.calls.find(c=>c.rpc).hasOnlyToken,true);await assert.rejects(f.SellerServices.joinStaff(student,{token},f.client),{code:'STAFF_MEMBERSHIP_CONFLICT'});});
test('concurrent join handling with modeled RPC: not proof of DB row locks',async()=>{const f=fixture({actor:student});const token=f.t.issueStaffToken(restaurant,seller).token;const results=await Promise.allSettled([f.SellerServices.joinStaff(student,{token},f.client),f.SellerServices.joinStaff(student,{token},f.client)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);});
for(const [options,code] of [[{rpcError:{code:'PGRST202',message:'PRIVATE'}},'STAFF_JOIN_RPC_UNAVAILABLE'],[{rpcError:{code:'42501',message:'PRIVATE'}},'DATABASE_ACCESS_DENIED'],[{rpcError:{code:'P0001',message:'STAFF_TOKEN_EXPIRED'}},'STAFF_TOKEN_EXPIRED'],[{rpcError:{code:'P0001',message:'STAFF_TOKEN_CONFIGURATION_MISSING'}},'STAFF_TOKEN_CONFIGURATION_MISSING'],[{network:true},'STAFF_JOIN_RESULT_UNKNOWN'],[{wrongResponse:true},'STAFF_JOIN_RESULT_UNKNOWN'],[{rpcError:{code:'PRIVATE',message:'PRIVATE'}},'STAFF_JOIN_RESULT_UNKNOWN']])test('RPC error safely mapped without retry '+code,async()=>{const f=fixture({...options,actor:student});await assert.rejects(f.SellerServices.joinStaff(student,{token:f.t.issueStaffToken(restaurant,seller).token},f.client),{code});assert.equal(f.calls.filter(c=>c.rpc).length,1);});
test('expired join token rejected before SDK access',async()=>{const f=fixture({actor:student});const token=f.t.issueStaffToken(restaurant,seller).token;f.t.clock.advance(300000);await assert.rejects(f.SellerServices.joinStaff(student,{token},f.client),{code:'STAFF_TOKEN_EXPIRED'});assert.equal(f.calls.length,0);});
test('actual staff HTTP helper verifies Origin/session/JSON and maps blocker without leaking details',async()=>{
 const f=fixture({actor:student,rpcError:{code:'PGRST202',message:'PRIVATE'}});const helper=load('../lib/seller/staff-http.ts',{'next/server':{NextResponse:{json:(data,options)=>Response.json(data,options)}},'@/lib/supabase/server':{createClient:async()=>f.client},'@/services/seller.service':f});
 const request=(origin,body)=>new Request('http://localhost:3000/api/staff/join',{method:'POST',headers:{origin,host:'localhost:3000','content-type':'application/json'},body});
 const action=(id,input,client)=>f.SellerServices.joinStaff(id,input,client);
 assert.equal((await helper.handleStaffRequest(request('https://elsewhere.invalid','{}'),action)).status,403);
 assert.equal((await helper.handleStaffRequest(request('http://localhost:3000','bad'),action)).status,400);
 const r=await helper.handleStaffRequest(request('http://localhost:3000',JSON.stringify({token:f.t.issueStaffToken(restaurant,seller).token})),action);
 assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).error.code,'STAFF_JOIN_RPC_UNAVAILABLE');
});
test('same signed token reaches RPC for two different students (mock DB, not SQL integration)',async()=>{const a=fixture({actor:student}),b=fixture({actor:'33333333-3333-4333-8333-333333333333'});const token=a.t.issueStaffToken(restaurant,seller).token;const first=await a.SellerServices.joinStaff(student,{token},a.client);const second=await b.SellerServices.joinStaff('33333333-3333-4333-8333-333333333333',{token},b.client);assert.equal(first.profile.work_for_restaurant_id,restaurant);assert.equal(second.profile.work_for_restaurant_id,restaurant);assert.notEqual(first.profile.id,second.profile.id);});
test('RPC zero-row conditional-update conflict is not reported as success',async()=>{const f=fixture({actor:student,rpcError:{code:'P0001',message:'STAFF_ROLE_CONFLICT'}});await assert.rejects(f.SellerServices.joinStaff(student,{token:f.t.issueStaffToken(restaurant,seller).token},f.client),{code:'STAFF_ROLE_CONFLICT'});assert.equal(f.calls.filter(c=>c.rpc).length,1);});
