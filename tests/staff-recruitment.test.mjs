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
const second = "33333333-3333-4333-8333-333333333333";
const restaurant = "44444444-4444-4444-8444-444444444444";
const otherRestaurant = "55555555-5555-4555-8555-555555555555";
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
  test(`dedicated signing config required: ${String(key)}`, () => {
    const t = tokenTools(clock(), { STAFF_INVITATION_SECRET: key });
    assert.throws(() => t.issueStaffToken(restaurant, seller), /STAFF_TOKEN_CONFIGURATION_MISSING/);
  });
}

class DatabaseConfigurationError extends Error {
  constructor(code = "DATABASE_CONFIGURATION_MISSING") { super(code); this.code = code; }
}
function fixture(options = {}) {
  const c = clock(); const t = tokenTools(c, options.signingMissing ? {} : { STAFF_INVITATION_SECRET: secret }); const calls = [];
  const users = {
    [seller]: { id: seller, role: options.issuerRole ?? "seller", status: options.issuerStatus ?? "active", work_for_restaurant_id: null },
    [student]: { id: student, role: options.role ?? "student", status: options.status ?? "active", work_for_restaurant_id: options.work ?? null },
    [second]: { id: second, role: "student", status: "active", work_for_restaurant_id: null },
  };
  let tail = Promise.resolve();
  const database = {
    DatabaseConfigurationError,
    getDatabasePool() {
      calls.push({ kind: "POOL" });
      if (options.noConfig) throw new DatabaseConfigurationError();
      if (options.badConfig) throw new DatabaseConfigurationError("DATABASE_CONFIGURATION_INVALID");
      return { async connect() {
        calls.push({ kind: "CONNECT" });
        if (options.connectFailure) throw new Error("SECRET_CONNECTION");
        let unlock; let snapshot;
        return {
          async query(sql, params) {
            const kind = sql.includes("ANY($1") ? "USERS" : sql.startsWith("SELECT role") ? "SELLER"
              : sql.startsWith("SELECT id FROM public.restaurants") ? "RESTAURANT" : sql.trim().split(/\s+/)[0];
            calls.push({ kind, sql, params });
            if (options.failAt === kind) throw new Error("SECRET_DB");
            if (kind === "USERS" || kind === "SELLER") {
              // Simulation seulement: not a PostgreSQL row-lock integration test.
              const before = tail; tail = new Promise((resolve) => { unlock = resolve; }); await before;
              snapshot = structuredClone(users);
              const ids = kind === "USERS" ? params[0] : [params[0]];
              return { rows: ids.filter((id) => !(options.missingIssuer && id === seller) && !(options.missingUser && id === student))
                .map((id) => users[id]).filter(Boolean).map((row) => ({ ...row })) };
            }
            if (kind === "RESTAURANT") {
              assert.ok(!/status|operating_status/.test(sql));
              if (options.expireAfterLock) c.advance(300000);
              return { rows: options.notOwner || options.noRestaurant ? [] : [{ id: params[0] }] };
            }
            if (kind === "UPDATE") {
              users[params[1]].role = "staff"; users[params[1]].work_for_restaurant_id = params[0];
              return { rowCount: options.zeroUpdate ? 0 : 1, rows: [{ ...users[params[1]], token: "SECRET_TOKEN" }] };
            }
            if (kind === "ROLLBACK") {
              if (options.rollbackFailure) throw new Error("SECRET_ROLLBACK");
              if (snapshot) for (const id of Object.keys(users)) users[id] = snapshot[id];
              unlock?.();
            }
            if (kind === "COMMIT") unlock?.();
            return { rows: [] };
          },
          release(discard) { calls.push({ kind: "RELEASE", discard }); if (discard) unlock?.(); },
        };
      } };
    },
  };
  const service = load("../services/seller.service.ts", { "@/lib/database/server": database, "@/lib/seller/staff-token": t,
    ...(options.qrFailure ? { qrcode: { toDataURL: async () => { throw new Error("SECRET_QR"); } } } : {}) });
  return { ...service, tokens: t, clock: c, users, calls, kinds: () => calls.map((v) => v.kind),
    token: () => (options.signingMissing ? tokenTools(c) : t).issueStaffToken(restaurant, seller).token };
}
test("issue QR uses seller ownership locks and real local PNG; inactive/closed restaurant allowed", async () => {
  const f = fixture();
  const result = await f.SellerServices.createStaffInvitation(seller, restaurant, {});
  assert.deepEqual(f.kinds(), ["POOL", "CONNECT", "BEGIN", "SELLER", "RESTAURANT", "COMMIT", "RELEASE"]);
  assert.equal(JSON.parse(result.qrPayload).token, result.token);
  assert.equal(JSON.parse(result.qrPayload).type, "studentfood.staff-invite");
  assert.equal(f.tokens.verifyStaffToken(result.token).issuedBy, seller);
  const png = Buffer.from(result.qrImageDataUrl.split(",")[1], "base64");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 512);
  const decodedPng = pngjs.PNG.sync.read(png);
  const decodedQr = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height);
  assert.ok(decodedQr, "Generated PNG must decode as a QR code");
  assert.equal(decodedQr.data, result.qrPayload);
  assert.ok(!result.token.includes(secret));
});
test("multiple users may join with same QR; regenerate does not consume/extend old QR", async () => {
  const f = fixture(); const token = f.token();
  await f.SellerServices.joinStaff(student, { token });
  assert.equal(f.tokens.verifyStaffToken(token).restaurantId, restaurant);
  await f.SellerServices.joinStaff(second, { token });
  assert.equal(f.users[student].role, "staff"); assert.equal(f.users[second].role, "staff");
  const update = f.calls.find((call) => call.kind === "UPDATE");
  assert.match(update.sql, /role = 'staff', work_for_restaurant_id = \$1, updated_at = now\(\)/);
  assert.match(update.sql, /status = 'active' AND role = 'student' AND work_for_restaurant_id IS NULL/);
  const lock = f.calls.find((call) => call.kind === "USERS");
  assert.match(lock.sql, /ORDER BY id FOR UPDATE/);
  assert.deepEqual(Array.from(lock.params[0]), [seller, student].sort());
  assert.ok(f.calls.every((call) => !(JSON.stringify(call.params) ?? "").includes(token)));
});
test("join validates token before DB and rechecks expiry after waiting for locks", async () => {
  const f = fixture(); const token = f.token();
  await assert.rejects(f.SellerServices.joinStaff(student, { token: token + "tampered" }), /INVALID_STAFF_TOKEN/);
  assert.equal(f.calls.length, 0);
  const g = fixture({ expireAfterLock: true });
  await assert.rejects(g.SellerServices.joinStaff(student, { token: g.token() }), /STAFF_TOKEN_EXPIRED/);
  assert.ok(!g.kinds().includes("UPDATE")); assert.ok(g.kinds().includes("ROLLBACK"));
});
test("repeated join conflicts without another write; two restaurants race for a student (mock lock)", async () => {
  const f = fixture(); const token = f.token();
  const results = await Promise.allSettled([
    f.SellerServices.joinStaff(student, { token }),
    f.SellerServices.joinStaff(student, { token: f.tokens.issueStaffToken(otherRestaurant, seller).token }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.code, "STAFF_MEMBERSHIP_CONFLICT");
  assert.equal(f.kinds().filter((k) => k === "UPDATE").length, 1);
  await assert.rejects(f.SellerServices.joinStaff(student, { token }), /STAFF_MEMBERSHIP_CONFLICT/);
});
for (const [options, code] of [
  [{ issuerRole: "student" }, "ISSUER_NOT_ALLOWED"], [{ issuerStatus: "inactive" }, "ISSUER_NOT_ALLOWED"],
  [{ missingIssuer: true }, "ISSUER_NOT_ALLOWED"], [{ missingUser: true }, "PROFILE_NOT_FOUND"],
  [{ status: "inactive" }, "ACCOUNT_INACTIVE"], [{ role: "staff" }, "STAFF_ROLE_CONFLICT"],
  [{ role: "seller" }, "STAFF_ROLE_CONFLICT"], [{ work: otherRestaurant }, "STAFF_MEMBERSHIP_CONFLICT"],
  [{ notOwner: true }, "RESTAURANT_NOT_FOUND"], [{ zeroUpdate: true }, "STAFF_ROLE_CONFLICT"],
  [{ noConfig: true }, "DATABASE_CONFIGURATION_MISSING"], [{ badConfig: true }, "DATABASE_CONFIGURATION_INVALID"],
  [{ connectFailure: true }, "STAFF_OPERATION_FAILED"],
  [{ signingMissing: true }, "STAFF_TOKEN_CONFIGURATION_MISSING"],
]) {
  test(`join rejects ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await assert.rejects(f.SellerServices.joinStaff(student, { token: f.token() }), { message: code });
    assert.ok(!f.kinds().includes("COMMIT"));
    if (f.kinds().includes("CONNECT") && !options.connectFailure) assert.equal(f.calls.at(-1).kind, "RELEASE");
  });
}
for (const [options, code] of [
  [{ issuerRole: "staff" }, "SELLER_REQUIRED"], [{ issuerStatus: "inactive" }, "ACCOUNT_INACTIVE"],
  [{ missingIssuer: true }, "PROFILE_NOT_FOUND"], [{ notOwner: true }, "RESTAURANT_NOT_FOUND"],
  [{ noConfig: true }, "DATABASE_CONFIGURATION_MISSING"], [{ qrFailure: true }, "STAFF_OPERATION_FAILED"],
  [{ signingMissing: true }, "STAFF_TOKEN_CONFIGURATION_MISSING"],
]) {
  test(`issue rejects ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await assert.rejects(f.SellerServices.createStaffInvitation(seller, restaurant, {}), { message: code });
  });
}
for (const mode of ["issue", "join"]) {
  for (const failAt of ["BEGIN", mode === "join" ? "USERS" : "SELLER", "RESTAURANT", "COMMIT", ...(mode === "join" ? ["UPDATE"] : [])]) {
    test(`${mode} ${failAt} error rolls back/releases safely`, async () => {
      const f = fixture({ failAt });
      const result = mode === "issue" ? f.SellerServices.createStaffInvitation(seller, restaurant, {}) : f.SellerServices.joinStaff(student, { token: f.token() });
      await assert.rejects(result, /STAFF_OPERATION_FAILED/);
      assert.equal(f.kinds().includes("ROLLBACK"), failAt !== "BEGIN");
      assert.equal(f.calls.at(-1).kind, "RELEASE");
    });
  }
}
test("rollback failure discards connection", async () => {
  const f = fixture({ zeroUpdate: true, rollbackFailure: true });
  await assert.rejects(f.SellerServices.joinStaff(student, { token: f.token() }), /STAFF_OPERATION_FAILED/);
  assert.equal(f.calls.at(-1).discard, true);
});
for (const input of [null, [], {}, { token: 1 }, { token: "" }, { token: "x", userId: second }, { token: "x", role: "staff" }, { token: "x", work_for_restaurant_id: restaurant }]) {
  test(`join invalid runtime payload ${JSON.stringify(input)}`, async () => {
    const f = fixture(); await assert.rejects(f.SellerServices.joinStaff(student, input)); assert.equal(f.calls.length, 0);
  });
}
test("issue validates UUID and refuses client TTL/owner fields before DB", async () => {
  const f = fixture();
  for (const input of [null, [], { ttl: 900 }, { owner_id: seller }]) await assert.rejects(f.SellerServices.createStaffInvitation(seller, restaurant, input), /SELLER_VALIDATION_ERROR/);
  await assert.rejects(f.SellerServices.createStaffInvitation(seller, "bad", {}), /restaurantId/);
  assert.equal(f.calls.length, 0);
});

function apiFixture(mode, options = {}) {
  const f = fixture(options); let authReads = 0;
  const http = load("../lib/seller/staff-http.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/services/seller.service": f,
    "@/lib/supabase/server": { async createClient() { return { auth: { async getUser() {
      authReads++; return { data: { user: options.noUser ? null : { id: mode === "issue" ? seller : student } }, error: options.authError ? new Error("SECRET_AUTH") : null };
    } } }; } },
  });
  const route = load(mode === "issue" ? "../app/api/seller/restaurants/[restaurantId]/staff-qr/route.ts" : "../app/api/staff/join/route.ts",
    { "@/lib/seller/staff-http": http, "@/services/seller.service": f });
  return { ...f, route, authReads: () => authReads,
    request(body = JSON.stringify(mode === "issue" ? {} : { token: f.token() })) {
      return new Request("https://example.com/api/test", { method: "POST", headers: { origin: "https://example.com", "Content-Type": "application/json" }, body });
    }, call(request) { return route.POST(request, { params: Promise.resolve({ restaurantId: restaurant }) }); },
  };
}
for (const mode of ["issue", "join"]) {
  test(`${mode} API authenticates real service, no-store and no GET action`, async () => {
    const f = apiFixture(mode); const response = await f.call(f.request());
    assert.equal(response.status, mode === "issue" ? 201 : 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(f.route.GET, undefined);
    const text = await response.text(); assert.ok(!text.includes(secret)); assert.ok(!text.includes("SECRET"));
  });
  for (const option of [{ noUser: true }, { authError: true }]) {
    test(`${mode} API denies unauthenticated ${JSON.stringify(option)}`, async () => {
      const f = apiFixture(mode, option); assert.equal((await f.call(f.request())).status, 401); assert.equal(f.calls.length, 0);
    });
  }
  test(`${mode} API rejects Origin and malformed JSON`, async () => {
    const f = apiFixture(mode); const req = f.request(); req.headers.delete("origin");
    assert.equal((await f.call(req)).status, 403); assert.equal(f.authReads(), 0);
    assert.equal((await f.call(f.request("bad-json"))).status, 400); assert.equal(f.calls.length, 0);
    const foreign = f.request(); foreign.headers.set("origin", "https://example.com.attacker.invalid");
    assert.equal((await f.call(foreign)).status, 403);
  });
}
for (const [options, status] of [[{ role: "seller" }, 409], [{ notOwner: true }, 404], [{ noConfig: true }, 503], [{ signingMissing: true }, 503], [{ failAt: "UPDATE" }, 500]]) {
  test(`join API sanitized failure ${JSON.stringify(options)}`, async () => {
    const f = apiFixture("join", options); const response = await f.call(f.request());
    assert.equal(response.status, status); assert.ok(!(await response.text()).includes("SECRET"));
  });
}
test("expired token API returns 410 without DB access", async () => {
  const f = apiFixture("join"); const request = f.request(); f.clock.advance(300000);
  assert.equal((await f.call(request)).status, 410); assert.equal(f.calls.length, 0);
});
