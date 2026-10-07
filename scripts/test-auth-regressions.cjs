const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");

// Real flow signatures, mocked network/database. Never reads .env or calls providers.
function load(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, URL, Buffer, Date, Error, TypeError, setTimeout, clearTimeout,
    process: { env: { SUPABASE_SERVICE_ROLE_KEY: "test-only-secret" } },
    console: { error() {} },
    require(name) {
      if (name === "server-only") return {};
      if (name === "node:crypto") return crypto;
      assert.ok(name in mocks, "Unexpected dependency: " + name);
      return mocks[name];
    },
  });
  return exports;
}

const flowTools = load("lib/auth/zalo-flow.ts", {
  "next/headers": {},
  "@/services/zalo.service": {},
});
const accountService = load("services/zalo-account.service.ts", {});
const googleUser = { id: "google-user", email: "test@example.com", identities: [{ provider: "google" }] };

function fixture(options = {}) {
  const calls = [];
  let owner = options.owner === undefined ? googleUser.id : options.owner;
  const client = { auth: {
    getUser: async () => ({ data: { user: options.currentUser === undefined ? googleUser : options.currentUser }, error: null }),
    verifyOtp: async ({ token_hash, type }) => {
      assert.equal(token_hash, "server-only-token");
      assert.equal(type, "magiclink");
      calls.push("session:" + owner);
      return { data: { user: { id: owner } }, error: null };
    },
  } };
  const admin = {
    rpc: async (fn, args) => {
      if (options.databaseError) return { data: null, error: { message: "DATABASE_UNAVAILABLE" } };
      if (fn === "resolve_zalo_user") return { data: owner, error: null };
      assert.equal(fn, "link_zalo_identity");
      assert.equal(args.p_zalo_id, "123456");
      calls.push("link:" + args.p_user_id);
      if (options.conflict) return { error: { message: "ZALO_ALREADY_LINKED" } };
      if (owner && owner !== args.p_user_id) return { error: { message: "ZALO_ALREADY_LINKED" } };
      owner = args.p_user_id;
      return { error: null };
    },
    auth: { admin: {
      createUser: async (input) => {
        calls.push("create");
        assert.equal(input.email, "123456@zalo.app");
        if (options.createError) return { data: {}, error: options.createError };
        owner = "zalo-user";
        return { data: { user: { id: owner } }, error: null };
      },
      getUserById: async (id) => ({
        data: { user: { id, email: id === googleUser.id ? googleUser.email : "123456@zalo.app" } }, error: null,
      }),
      generateLink: async (input) => {
        calls.push("token");
        assert.equal(input.type, "magiclink");
        assert.equal(input.email, owner === googleUser.id ? googleUser.email : "123456@zalo.app");
        return { data: { user: { id: options.tokenMismatch ? "wrong-user" : owner }, properties: { hashed_token: "server-only-token" } }, error: null };
      },
    } },
    from: (table) => {
      assert.equal(table, "users");
      return { upsert: async (profile, opts) => {
        calls.push("profile");
        assert.equal(profile.id, owner);
        assert.equal(opts.ignoreDuplicates, true);
        return { error: options.profileError ? { message: "PROFILE_FAILED" } : null };
      } };
    },
  };
  return { admin, client, calls };
}

async function callbackCase(options = {}) {
  const f = fixture(options);
  const mode = options.mode || "link";
  const flow = { mode, userId: mode === "link" ? googleUser.id : null, state: "correct-state",
    verifier: "test-verifier", expiresAt: Date.now() + 600000 };
  let cookie = flowTools.encodeZaloFlow(flow);
  if (options.tampered) cookie += "x";
  const callback = load("app/api/auth/zalo/callback/route.ts", {
    "next/headers": { cookies: async () => ({
      get: () => cookie ? { value: cookie } : undefined,
      delete: () => { cookie = null; },
    }) },
    "next/server": { NextResponse: {
      json: (body, init) => ({ body, status: init.status }),
      redirect: (url) => ({ url: String(url), status: 307, headers: new Headers() }),
    } },
    "@/lib/auth/zalo-flow": flowTools,
    "@/lib/supabase/server": { createClient: async () => f.client },
    "@/lib/supabase/admin": { createAdminClient: () => f.admin },
    "@/services/zalo-account.service": accountService,
    "@/services/zalo.service": { ZaloAuthService: {
      getZaloAccessToken: async (code, verifier) => {
        f.calls.push("provider");
        assert.equal(verifier, flow.verifier);
        if (options.providerFailure) throw new Error("secret-provider-details");
        return { access_token: "not-a-real-token" };
      },
      getZaloProfile: async () => ({ id: "123456", name: "Test", img_url: "" }),
    } },
  });
  const url = new URL("http://localhost:3000/api/auth/zalo/callback");
  url.searchParams.set("state", options.badState ? "wrong-state" : flow.state);
  url.searchParams.set(options.cancelled ? "error" : "code", options.cancelled ? "access_denied" : "test-code");
  const response = await callback.GET({ url: String(url), nextUrl: url });
  return { ...f, response, replay: () => callback.GET({ url: String(url), nextUrl: url }) };
}

(async () => {
  const { AuthClientService: auth } = load("services/auth.service.ts", { "@/lib/supabase/client": {} });
  assert.equal(auth.getAuthErrorMessage({ code: "P0001", message: "USER_NOT_FOUND" }),
    auth.getAuthErrorMessage({ code: "USER_NOT_FOUND" }));

  const validFlow = { mode: "link", userId: googleUser.id, state: "s", verifier: "v", expiresAt: Date.now() + 60000 };
  const signed = flowTools.encodeZaloFlow(validFlow);
  assert.equal(flowTools.decodeZaloFlow(signed).userId, googleUser.id);
  assert.equal(flowTools.decodeZaloFlow(signed + "x"), null);
  assert.equal(flowTools.decodeZaloFlow(flowTools.encodeZaloFlow({ ...validFlow, expiresAt: 0 })), null);
  const payload = Buffer.from(JSON.stringify({ ...validFlow, userId: "attacker" })).toString("base64url");
  assert.equal(flowTools.decodeZaloFlow(payload + "." + signed.split(".")[1]), null);

  const linked = await callbackCase();
  assert.match(linked.response.url, /zalo_link=success$/);
  assert.deepEqual(linked.calls, ["provider", "link:google-user"]);
  assert.equal((await linked.replay()).status, 400);

  for (const options of [{ badState: true }, { tampered: true }]) {
    const result = await callbackCase(options);
    assert.equal(result.response.status, 400);
    assert.deepEqual(result.calls, []);
  }
  for (const currentUser of [null, { ...googleUser, id: "other-user" }, { ...googleUser, identities: [] }]) {
    const result = await callbackCase({ currentUser });
    assert.match(result.response.url, /zalo_link=session_changed$/);
    assert.deepEqual(result.calls, []);
  }
  const cancelled = await callbackCase({ cancelled: true });
  assert.match(cancelled.response.url, /zalo_link=cancelled$/);
  assert.deepEqual(cancelled.calls, []);
  const conflict = await callbackCase({ conflict: true });
  assert.match(conflict.response.url, /zalo_link=conflict$/);
  assert.ok(!conflict.calls.includes("token"));
  const failure = await callbackCase({ providerFailure: true });
  assert.match(failure.response.url, /zalo_link=failed$/);

  // A linked Zalo signs in to the original Google UUID, without createUser or profile overwrite.
  const login = await callbackCase({ mode: "login" });
  assert.equal(login.response.url, "http://localhost:3000/");
  assert.deepEqual(login.calls, ["provider", "link:google-user", "token", "session:google-user"]);
  const legacy = await callbackCase({ mode: "login", owner: "zalo-user" });
  assert.equal(legacy.response.status, 307);
  assert.ok(!legacy.calls.includes("create"));
  assert.ok(legacy.calls.includes("session:zalo-user"));
  const fresh = await callbackCase({ mode: "login", owner: null });
  assert.equal(fresh.response.status, 307);
  assert.deepEqual(fresh.calls, ["provider", "create", "profile", "link:zalo-user", "token", "session:zalo-user"]);
  for (const options of [
    { tokenMismatch: true }, { databaseError: true }, { owner: "zalo-user", profileError: true },
    { owner: null, createError: { status: 422, code: "invalid_email", message: "Invalid email" } },
  ]) {
    const result = await callbackCase({ mode: "login", ...options });
    assert.equal(result.response.status, 500);
    assert.ok(!result.calls.some((call) => call.startsWith("session:")));
  }

  async function startLink({ origin = "http://localhost:3000", user = googleUser, linked = null, dbError = null } = {}) {
    let beganFor = null;
    let authReads = 0;
    const route = load("app/api/auth/zalo/link/route.ts", {
      "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
      "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => {
        authReads++;
        return { data: { user }, error: null };
      } } }) },
      "@/lib/supabase/admin": { createAdminClient: () => ({ from: (table) => ({
        select: () => ({ eq: (key, value) => ({ maybeSingle: async () => {
          assert.equal(value, user.id);
          return { data: table === "users" ? { status: "active" } : linked, error: dbError };
        } }) }),
      }) }) },
      "@/lib/auth/zalo-flow": { beginZaloFlow: async (id) => { beganFor = id; return "https://oauth.zaloapp.com/v4/permission"; } },
      "@/services/zalo-account.service": accountService,
    });
    const response = await route.POST({ url: "http://localhost:3000/api/auth/zalo/link", headers: new Headers({ origin }) });
    return { response, beganFor, authReads, route };
  }
  const foreign = await startLink({ origin: "https://untrusted.example" });
  assert.equal(foreign.response.status, 403);
  assert.equal(foreign.authReads, 0);
  assert.equal((await startLink({ user: null })).response.status, 401);
  assert.equal((await startLink({ user: { ...googleUser, identities: [] } })).response.status, 403);
  assert.equal((await startLink({ linked: { user_id: googleUser.id } })).response.status, 409);
  const started = await startLink();
  assert.equal(started.response.status, 200);
  assert.equal(started.beganFor, googleUser.id);
  const methods = await (await startLink({ linked: { user_id: googleUser.id } })).route.GET();
  assert.equal(methods.body.userId, googleUser.id);
  assert.equal(methods.body.google, true);
  assert.equal(methods.body.zalo, true);
  console.log("Auth/linking regressions passed (signed state, ownership, replay, conflicts, original UUID, failures).");
})().catch((error) => { console.error(error); process.exitCode = 1; });
