import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
function load(admin, fetch=()=>assert.fail('unexpected network')) {
 let source=stripTypeScriptTypes(readFileSync(new URL('../services/cloudinary-server.service.ts',import.meta.url),'utf8'), { mode: 'transform' });
 source=source.replace(/import "server-only";/,'').replace(/import\s*\{[\s\S]*?\}\s*from[^;]+;/g,'').replace(/export /g,'');
 const env={CLOUDINARY_CLOUD_NAME:'test',CLOUDINARY_API_KEY:'key',CLOUDINARY_API_SECRET:'private-secret',CLOUDINARY_SIGNED_UPLOAD_PRESET:'signed'};
 return new Function('createHash','createAdminClient','fetch','process',source+';return {issueUpload,completeUpload,signUpload};')(createHash,()=>admin,fetch,{env});
}
const id='11111111-1111-4111-8111-111111111111';
function database({role='student',intent=null,assetError=false}={}) {
 const mutations=[]; let rpcCalls=0;
 const admin={rpc:async()=>{rpcCalls++;return {data:{id,public_id:`student-food/avatar/owner/${id}`}};}, from(table){
  let update=false;
  const q={select(){return q},eq(){return q},is(){return q},lte(){return q},limit(){return q},update(value){update=true;mutations.push(value);return q},
   maybeSingle:async()=>({data:table==='users'?{status:'active',role,work_for_restaurant_id:null}:table==='restaurants'?null:update?{id}:intent,error:null}),
   then(resolve){return Promise.resolve({data:table==='restaurants'?[]:null,error:assetError?{}:null}).then(resolve)} };
  return q;
 }};
 return {admin,mutations,get rpcCalls(){return rpcCalls}};
}
test('signature uses server-controlled params and never returns secret',async()=>{
 const d=database();const service=load(d.admin);
 const ticket=await service.issueUpload('owner',{purpose:'avatar',mime:'image/png',size:123,public_id:'victim',overwrite:true,folder:'victim'});
 assert.equal(ticket.params.overwrite,'false');assert.ok(ticket.params.public_id.startsWith('student-food/avatar/owner/'));
 assert.equal(ticket.signature,createHash('sha256').update(Object.keys(ticket.params).sort().map(k=>`${k}=${ticket.params[k]}`).join('&')+'private-secret').digest('hex'));
 assert.ok(!JSON.stringify(ticket).includes('private-secret'));assert.equal(d.rpcCalls,1);
});
test('student cannot request restaurant/menu upload and invalid files are rejected',async()=>{
 const d=database(),service=load(d.admin);
 await assert.rejects(service.issueUpload('owner',{purpose:'menu',restaurantId:id,mime:'image/png',size:12}),/Chỉ chủ quán/);
 await assert.rejects(service.issueUpload('owner',{purpose:'avatar',mime:'image/svg+xml',size:12}),/Chỉ nhận/);
 await assert.rejects(service.issueUpload('owner',{purpose:'avatar',mime:'image/png',size:6000000}),/Chỉ nhận/);
 assert.equal(d.rpcCalls,0);
});
test('verification trusts provider metadata, not client URL, and persists canonical result',async()=>{
 const intent={id,purpose:'avatar',public_id:`student-food/avatar/owner/${id}`,restaurant_id:null,created_at:new Date().toISOString()};
 const d=database({intent});let calls=0;
 const service=load(d.admin,async(url)=>{calls++;assert.ok(url.startsWith('https://api.cloudinary.com/v1_1/test/resources/image/upload/'));return Response.json({public_id:intent.public_id,resource_type:'image',type:'upload',format:'png',bytes:100,version:123,width:20,height:20,secure_url:'https://evil.test'});});
 const result=await service.completeUpload('owner',id);
 assert.equal(result.secureUrl,`https://res.cloudinary.com/test/image/upload/v123/${intent.public_id}.png`);assert.equal(calls,1);
 assert.equal(d.mutations.at(-1).verified_url,result.secureUrl);
});
test('foreign intent cannot trigger Cloudinary lookup',async()=>{
 const d=database();await assert.rejects(load(d.admin).completeUpload('owner',id),/Không tìm thấy/);
});
test('oversize provider asset is not recorded as verified',async()=>{
 const intent={id,purpose:'avatar',public_id:'asset',created_at:new Date().toISOString()};
 const d=database({intent});
 await assert.rejects(load(d.admin,async()=>Response.json({public_id:'asset',resource_type:'image',type:'upload',format:'png',bytes:9000000,version:1})).completeUpload('owner',id),/không đạt/);
 assert.ok(!d.mutations.some(value=>value.verified_url));
});


test('upload API rejects cross-origin and anonymous requests before issuing a signature', async () => {
 let source=stripTypeScriptTypes(readFileSync(new URL('../app/api/uploads/cloudinary/route.ts',import.meta.url),'utf8'));
 source=source.replace(/import\s*\{[\s\S]*?\}\s*from[^;]+;/g,'').replace(/export /g,'');
 let sameOrigin=false, signed=0;
 const handler=new Function('NextResponse','createClient','isSameOrigin','issueUpload','completeUpload','UploadError',source+';return POST;')(
  {json:(body,init)=>Response.json(body,init)},async()=>({auth:{getUser:async()=>({data:{user:null},error:null})}}),()=>sameOrigin,
  ()=>{signed++;},()=>assert.fail('complete must not run'),class extends Error{});
 const request=()=>new Request('https://app.test/api/uploads/cloudinary',{method:'POST',body:JSON.stringify({action:'sign',purpose:'avatar'})});
 assert.equal((await handler(request())).status,403);
 sameOrigin=true;
 assert.equal((await handler(request())).status,401);
 assert.equal(signed,0);
});
