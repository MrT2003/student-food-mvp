import assert from "node:assert/strict";
import {test} from "node:test";
import {load,userId,other} from "./seller-sdk-fixture.mjs";
const jsx=(type,props)=>({type,props});
const nodes=n=>!n||typeof n!=="object"?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function hookHarness(file,mocks={},globals={}) {
 let sc=0,rc=0;const states=[],refs=[],effects=[];
 const exports=load(file,{react:{useState(value){const i=sc++;if(!(i in states))states[i]=typeof value==="function"?value():value;return [states[i],next=>{states[i]=typeof next==="function"?next(states[i]):next;}];},useRef(value){const i=rc++;return refs[i]??(refs[i]={current:value});},useEffect(fn){effects.push(fn);}},"react/jsx-runtime":{jsx,jsxs:jsx},...mocks},globals);
 return {render(name,props){sc=rc=0;return exports[name](props);},effects,states};
}

test("merged providers retain Auth -> SellerAccess children and one independent foreground feed",()=>{
 const f=load("../components/layout/AppProviders.tsx",{"react/jsx-runtime":{jsx,jsxs:jsx},"@/components/features/auth/AuthProvider":{default:"auth"},"@/components/features/seller/SellerAccessProvider":{SellerAccessProvider:"seller"},"../features/notifications/ForegroundNotifications":{default:"feed"}});
 const tree=f.default({children:"routes"});const auth=nodes(tree).find(n=>n.type==="auth");assert.equal(auth.props.children.type,"seller");assert.equal(auth.props.children.props.children,"routes");assert.equal(nodes(tree).filter(n=>n.type==="feed").length,1);
});
test("merged account retains store-join, security and notifications sections",()=>{
 const user={id:userId,name:"TEST",phone:"",avatar_url:null};const store=selector=>selector({user,status:"ready",setUser(){}});
 const ui=hookHarness("../components/features/account/AccountView.tsx",{
  "@/lib/auth/useAuthFlow":{useSignOut:()=>({logout(){},pending:false,signOutError:null})},"@/store/useAuthStore":{useAuthStore:store},"@/services/auth.service":{AuthClientService:{}},"@/services/cloudinary.service":{CloudinaryService:{}},"@/styles/account.module.css":{default:{}},"lucide-react":{},"next/image":{default:"img"},"./AccountSecurity":{default:"security"},"./AccountStoreJoin":{default:"join"},"./AccountNotifications":{default:"notifications"},"./AccountSuccessModal":{default:"modal"},
 });const root=ui.render("default");const tree=root.type(root.props);for(const type of ["join","security","notifications"])assert.equal(nodes(tree).filter(n=>n.type===type).length,1);
});
test("sign-in hook uses provider-specific pending state and respects pending/failed logout",async()=>{
 let logoutStatus="idle";const calls=[];
 const ui=hookHarness("../lib/auth/useAuthFlow.ts",{"next/navigation":{useRouter:()=>({})},"@/store/useAuthStore":{useAuthStore:{getState:()=>({logoutStatus})}},"@/services/auth.service":{AuthClientService:{signInWithGoogle:async()=>{calls.push("google");},singInWithZalo:()=>{calls.push("zalo");},getAuthErrorMessage:()=>"safe"}}});
 await ui.render("useSignIn").continueWithZalo();assert.equal(ui.render("useSignIn").pendingProvider,"zalo");assert.deepEqual(calls,["zalo"]);
 for(const flag of ["pending","failed"]){logoutStatus=flag;await ui.render("useSignIn").continueWithGoogle();assert.deepEqual(calls,["zalo"]);}
});
test("login caller passes pendingProvider plus logout disabled flag to actual social buttons",()=>{
 const loaded=load("../components/features/auth/SocialAuthButtons.tsx",{"lucide-react":{},"@/components/ui/Button":{default:"button"},"react/jsx-runtime":{jsx,jsxs:jsx}}).default;
 for(const logoutStatus of ["pending","failed","complete","idle"]){
  const view=load("../components/features/auth/RegisterView.tsx",{"@/components/features/auth/AuthBenefits":{default:"benefits"},"@/components/features/auth/AuthIntro":{default:"intro"},"@/components/features/auth/SocialAuthButtons":{default:loaded},"@/lib/auth/useAuthFlow":{useSignIn:()=>({pendingProvider:null,error:null,continueWithGoogle(){},continueWithZalo(){}}),useSignOut:()=>({logout(){},signOutError:"safe"})},"@/store/useAuthStore":{useAuthStore:selector=>selector({logoutStatus})},"@/styles/auth-fit.module.css":{default:{}},"react/jsx-runtime":{jsx,jsxs:jsx}});
  const social=nodes(view.default({mode:"login"})).find(n=>n.type===loaded);assert.equal(social.props.pendingProvider,null);const tree=loaded(social.props);assert.ok(nodes(tree).filter(n=>n.type==="button").every(n=>n.props.disabled===["pending","failed"].includes(logoutStatus)));
 }
});
test("signout hook prefetches login and refreshes only after logout settles",async()=>{
 let done;const calls=[];const ui=hookHarness("../lib/auth/useAuthFlow.ts",{"next/navigation":{useRouter:()=>({prefetch:path=>calls.push(["prefetch",path]),replace:path=>calls.push(["replace",path]),refresh:()=>calls.push(["refresh"])})},"@/store/useAuthStore":{useAuthStore:selector=>selector({logoutStatus:"idle",logoutError:null})},"@/services/auth.service":{AuthClientService:{signOut:()=>new Promise(resolve=>{done=resolve;})}}});
 const hook=ui.render("useSignOut");ui.effects.forEach(fn=>fn());const pending=hook.logout();assert.deepEqual(calls,[["prefetch","/auth/login"],["replace","/auth/login"]]);done();await pending;assert.deepEqual(calls.at(-1),["refresh"]);
});

function logoutSetup(options={}) {
 const events=[],storage=new Map();let state={user:{id:userId},status:"ready",logoutStatus:"idle",logoutOwner:null};let calls=0;
 if(options.registration)storage.set("student-food:push-registration",JSON.stringify({userId,token:"synthetic-registration",enabled:true}));
 const store={getState:()=>state,setState:patch=>{state={...state,...patch};}};
 const client={auth:{getUser:async()=>({data:{user:{id:options.changedOwner?other:userId}},error:null}),signOut:async input=>{events.push(["signOut",input.scope]);if(options.signOutError)throw Object.assign(Error("synthetic"),{status:400});return {error:null};}}};
 const token=load("../services/push-token.service.ts",{},{fetch:async(path,request)=>{calls++;events.push(["unregister",request.headers["X-Expected-User-Id"]]);assert.equal(request.method,"DELETE");assert.deepEqual(Object.keys(JSON.parse(request.body)),["token"]);return Response.json(options.unregisterFails?{error:"safe"}:{success:true},{status:options.unregisterFails?503:200});}});
 const lifecycle=load("../lib/firebase/pushLifecycle.ts",{"@/lib/supabase/client":{createClient:()=>client},"@/services/firebase.service":{FirebaseService:{deleteRegistrationToken:async()=>{events.push(["deleteSdk"]);return true;}}},"@/services/push-token.service":token},{navigator:{locks:{request:async(name,fn)=>{events.push(["lock",name]);return await fn();}}},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},window:{dispatchEvent(){}},Event});
 const retry=load("../lib/firebase/retry.ts",{},{setTimeout:fn=>{fn();return 1;}});
 const service=load("../services/auth.service.ts",{"@/lib/supabase/client":{createClient:()=>client},"@/lib/firebase/pushLifecycle":lifecycle,"@/store/useAuthStore":{useAuthStore:store},"@/lib/firebase/retry":retry,"@/services/push-token.service":token},{navigator:{locks:{request(){throw Error("Use lifecycle lock");}}}});
 return {...service,events,storage,state:()=>state,requests:()=>calls,lifecycle};
}
test("actual logout clears UI immediately, unregisters before SDK delete/signout and coalesces requests",async()=>{
 const f=logoutSetup({registration:true});const a=f.AuthClientService.signOut(),b=f.AuthClientService.signOut();assert.equal(a,b);assert.equal(f.state().user,null);assert.equal(f.state().logoutStatus,"pending");await a;
 assert.deepEqual(f.events.map(e=>e[0]),["lock","unregister","deleteSdk","signOut"]);assert.equal(f.events.at(-1)[1],"local");assert.equal(f.state().logoutStatus,"complete");assert.equal(f.requests(),1);assert.equal(JSON.parse(f.storage.get("student-food:push-registration")).enabled,false);
});
test("logout without push registration succeeds without touching Firebase/config",async()=>{
 const f=logoutSetup();await f.AuthClientService.signOut();assert.equal(f.requests(),0);assert.equal(f.events.some(e=>e[0]==="deleteSdk"),false);assert.equal(f.state().logoutStatus,"complete");
});
test("logout cleanup failure retains safe failed state and never signs out before cleanup",async()=>{
 const f=logoutSetup({registration:true,unregisterFails:true});await assert.rejects(f.AuthClientService.signOut());assert.equal(f.requests(),4);assert.equal(f.events.some(e=>e[0]==="signOut"),false);assert.equal(f.state().logoutStatus,"failed");assert.equal(f.state().user,null);
});
test("changed owner aborts logout without signing out new account; SDK signout error never reports complete",async()=>{
 const f=logoutSetup({registration:true,changedOwner:true});await assert.rejects(f.AuthClientService.signOut());assert.equal(f.requests(),0);assert.equal(f.events.some(e=>e[0]==="signOut"),false);
 const bad=logoutSetup({signOutError:true});await assert.rejects(bad.AuthClientService.signOut());assert.equal(bad.state().logoutStatus,"failed");
});

function foregroundSetup() {
 let owner=userId,saved=null,callbacks,stops=0,starts=0,supports=0;const events=new Map();
 const ui=hookHarness("../lib/firebase/useForegroundNotifications.ts",{"@/services/firebase.service":{FirebaseService:{isBrowserSupported:async()=>{supports++;return true;},onForegroundMessage:async fn=>{starts++;callbacks=fn;return()=>{stops++;};}}},"@/store/useAuthStore":{useAuthStore:{getState:()=>({user:{id:owner},logoutStatus:"idle"})}},"./pushLifecycle":{PUSH_CHANGED:"changed",PUSH_STORAGE_KEY:"saved",readPushRegistration:()=>saved}},{window:{addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)},document:{visibilityState:"visible"}});
 let cleanup;return {render:()=>ui.render("useForegroundNotifications",userId),start(){ui.effects.forEach(fn=>{cleanup=fn();});},saved(value){saved=value;events.get("changed")?.();},owner(value){owner=value;},send(payload){callbacks(payload);},counts:()=>({stops,starts,supports}),stop:()=>cleanup?.()};
}
test("optional push never initializes Firebase for user without opt-in; enable/disable attach and remove once",async()=>{
 const f=foregroundSetup();f.render();f.start();await tick();assert.deepEqual(f.counts(),{stops:0,starts:0,supports:0});f.saved({userId,enabled:true,token:"synthetic"});await tick();assert.equal(f.counts().starts,1);
 f.send({data:{recipientUserId:other,notificationId:"other",title:"ignored"}});assert.equal(f.render().notifications.length,0);
 f.send({data:{recipientUserId:userId,notificationId:"test-event",title:"visible",orderId:"https://invalid.example"}});assert.equal(f.render().notifications[0].href,"/orders");
 f.send({data:{recipientUserId:userId,notificationId:"test-event",title:"duplicate"}});assert.equal(f.render().notifications.length,1);
 f.saved({userId,enabled:false,token:""});await tick();assert.equal(f.render().notifications.length,0);assert.equal(f.counts().stops,1);f.stop();
});

function tokenRoute(options={}) {
 const mutations=[];let adminCalls=0;
 const route=load("../app/api/notifications/tokens/route.ts",{
  "next/server":{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:options.noUser?null:{id:userId}},error:null})}})},
  "@/lib/supabase/admin":{createAdminClient:()=>{
   adminCalls++;
   return {from(table){
    const filters=[];
    return {
     select(){return this;},eq(key,value){filters.push([key,value]);return this;},
     upsert:async(value)=>{mutations.push({table,mode:"upsert",owner:value.user_id});return {error:options.writeError?{message:"PRIVATE"}:null};},
     update(){mutations.push({table,mode:"update",filters});return this;},
     delete(){mutations.push({table,mode:"delete",filters});return this;},
     maybeSingle:async()=>({data:table==="users"?{status:options.inactive?"inactive":"active"}:options.conflict?null:{id:"synthetic-row"},error:null}),
     then(resolve){resolve({data:null,error:null});},
    };
   }};
  }},
 },{TextDecoder});
 return {async call(method="POST",body={token:"synthetic"},config={}){
  return route[method](new Request("http://localhost:3000/api/notifications/tokens",{method,headers:{Origin:config.origin??"http://app.example",Host:"app.example","X-Expected-User-Id":config.expected??userId,"Content-Type":"application/json"},body:JSON.stringify(body)}));
 },mutations,adminCalls:()=>adminCalls};
}

test("push token API uses shared normalized-Host Origin guard and verified owner",async()=>{
 const f=tokenRoute();assert.equal((await f.call()).status,200);assert.equal(f.mutations[0].owner,userId);assert.equal(f.mutations[1].filters.some(([k,v])=>k==="user_id"&&v===userId),true);
 const bad=tokenRoute();assert.equal((await bad.call("POST",{token:"synthetic"},{origin:"http://evil.example"})).status,403);assert.equal(bad.adminCalls(),0);
});
for(const [options,body,config,status]of [[{noUser:true},{token:"synthetic"},{},401],[{inactive:true},{token:"synthetic"},{},403],[{}, {token:"synthetic",user_id:other},{},400],[{},{token:"synthetic"},{expected:other},409],[{writeError:true},{token:"synthetic"},{},503],[{conflict:true},{token:"synthetic"},{},409]])test("push token API rejection stays safe "+status+" "+JSON.stringify(options),async()=>{
 const f=tokenRoute(options);const response=await f.call("POST",body,config);assert.equal(response.status,status);assert.equal(JSON.stringify(await response.json()).includes("PRIVATE"),false);
});
test("push DELETE scopes token and current user, never another owner",async()=>{
 const f=tokenRoute();assert.equal((await f.call("DELETE")).status,200);assert.equal(f.mutations[0].mode,"delete");assert.ok(f.mutations[0].filters.some(([k,v])=>k==="user_id"&&v===userId));
});
test("development notification test guard uses normalized Host; production returns 404 without send",async()=>{
 for(const env of ["development","production"]){let sends=0;const route=load("../app/api/notifications/test/route.ts",{"next/server":{NextResponse:{json:(body,init)=>Response.json(body,init)}},"@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:userId}},error:null})}})},"@/services/firebase-admin.service":{FirebaseAdminService:{sendToUser:async input=>{assert.equal(input.userId,userId);sends++;return {attempted:1,accepted:1,failed:0,removedTokens:0,failures:[],cleanupFailedIds:[],lookupFailed:false};}}}},{process:{env:{NODE_ENV:env}}});
 const request=new Request("http://localhost:3000/api/notifications/test",{method:"POST",headers:{Origin:"http://app.example",Host:"app.example"}});const response=await route.POST(request);assert.equal(response.status,env==="production"?404:200);assert.equal(sends,env==="production"?0:1);}
});

function authProviderSetup() {
 let state={user:{id:userId,role:"seller",status:"active",phone:"synthetic"},status:"ready",logoutStatus:"idle"},callbacks;const redirects=[];
 const store=Object.assign(selector=>selector({...state,setUser:user=>{state={...state,user};},setError(){}}),{getState:()=>state});
 const ui=hookHarness("../components/features/auth/AuthProvider.tsx",{"next/navigation":{usePathname:()=>"/seller",useRouter:()=>({replace:path=>redirects.push(path)})},"@/services/auth.service":{subscribeAuthProfile:(...args)=>{callbacks=args;return()=>{};},isSigningOutHere:()=>state.logoutStatus==="pending"},"@/store/useAuthStore":{useAuthStore:store},"@/lib/firebase/pushLifecycle":{enablePush:async()=>{}},"@/components/features/auth/RegisterView":{default:"login"},"@/components/layout/AuthShell":{default:"shell"}},{window:{location:{href:"http://localhost:3000/seller"},setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){}}});
 ui.render("default",{children:"seller content"});ui.effects.forEach(fn=>fn());
 return {render:()=>ui.render("default",{children:"seller content"}),profile:value=>callbacks[0](value),session:value=>callbacks[2](value),state:()=>state,setState:patch=>{state={...state,...patch};},redirects};
}
test("auth provider masks changed accounts and rejects late profile instead of restoring seller context",()=>{
 const f=authProviderSetup();f.session(userId);f.session(other);f.profile({id:userId,role:"seller"});assert.equal(f.state().user,null);assert.equal(f.render().props.role,"alert");
});
test("auth provider blocks late profiles during logout and redirects external signout",()=>{
 const f=authProviderSetup();f.setState({logoutStatus:"pending",user:null});f.profile({id:userId,role:"seller"});assert.equal(f.state().user,null);assert.equal(f.render().type,"shell");
 const external=authProviderSetup();external.session(userId);external.session(null);assert.equal(external.state().user,null);assert.equal(external.redirects.at(-1),"/auth/login");
});
function adminSetup(options={}) {
 const deleted=[],sent=[];
 const admin={from(table){assert.ok(["users","user_push_tokens"].includes(table));const filters=[];return {select(){return this;},eq(key,value){filters.push([key,value]);return this;},order(){return this;},limit(){return this;},gt(){return this;},delete(){deleted.push(filters);return this;},maybeSingle:async()=>({data:{status:options.inactive?"inactive":"active"},error:null}),then(resolve){resolve({data:deleted.includes(filters)?[{id:"row"}]:[{id:"row",token:"synthetic",updated_at:"fixed"}],error:null});}};}};
 const f=load("../services/firebase-admin.service.ts",{"firebase-admin/app":{getApps:()=>[{name:"student-food-server-push"}],cert(){throw Error("No credential fixture");},initializeApp(){throw Error("No live initialization");}},"firebase-admin/messaging":{getMessaging:()=>({sendEachForMulticast:async message=>{assert.equal(message.tokens.length,1);sent.push(message.data);return {responses:[options.dead?{success:false,error:{code:"messaging/registration-token-not-registered"}}:{success:true}]};}})},"@/lib/supabase/admin":{createAdminClient:()=>admin}});
 return {...f,deleted,sent};
}
test("admin sender uses verified target contract and cleans only exact dead-token row (mock SDK/DB)",async()=>{
 const input={userId,notificationId:"synthetic-event",title:"TEST",body:"TEST ONLY"};const f=adminSetup();assert.equal((await f.FirebaseAdminService.sendToUser(input)).accepted,1);assert.equal(f.sent[0].recipientUserId,userId);
 const dead=adminSetup({dead:true});const result=await dead.FirebaseAdminService.sendToUser(input);assert.equal(result.removedTokens,1);assert.deepEqual(dead.deleted[0].map(([k])=>k),["id","user_id","token","updated_at"]);
 const inactive=adminSetup({inactive:true});await assert.rejects(inactive.FirebaseAdminService.sendToUser(input),/PUSH_USER_INACTIVE_OR_MISSING/);assert.equal(inactive.sent.length,0);
});
test("Firebase VAPID validation reports the actual configured variable name without values",async()=>{
 const f=load("../services/firebase.service.ts",{},{window:{Notification:{}},Notification:{permission:"granted"},process:{env:{NEXT_PUBLIC_FIREBASE_VAPID_KEY:"synthetic-invalid"}}});
 await assert.rejects(f.FirebaseService.getRegistrationToken({active:{state:"activated"}}),error=>error.message.includes("NEXT_PUBLIC_FIREBASE_VAPID_KEY")&&!error.message.includes("synthetic-invalid"));
});
