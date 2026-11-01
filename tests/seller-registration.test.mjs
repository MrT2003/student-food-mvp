import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";
import { Client } from "pg";

// Chạy module thật, không cấp process.env thật, Supabase hoặc connection PostgreSQL thật.
function load(file, mocks = {}, globals = {}) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, URL, console: { error() { throw new Error("Must not log database errors"); } },
    require(id) {
      if (id === "server-only") return {};
      if (id === "@/lib/http/request-origin") return load("../lib/http/request-origin.ts");
      if (id === "node:crypto") return crypto;
      if (id in mocks) return mocks[id];
      if (id === "@/utilities/system.utility") return load("../utilities/system.utility.ts");
      throw new Error(`Unexpected import: ${id}`);
    },
    ...globals,
  });
  return exports;
}

const userId = "11111111-1111-4111-8111-111111111111";
const restaurantId = "22222222-2222-4222-8222-222222222222";
const payload = (patch = {}) => ({
  name: "  Cơm Đậm Đà  ", description: " Cơm ngon ", location: " KTX A ",
  cash: true, bank: false, scheduleMode: "later", ...patch,
});
const slugError = (patch = {}) => Object.assign(new Error("SECRET_DATABASE_DETAIL"), {
  code: "23505", schema: "public", table: "restaurants", constraint: "restaurants_slug_key", ...patch,
});
class DatabaseConfigurationError extends Error {
  constructor(code = "DATABASE_CONFIGURATION_MISSING") {
    super(code);
    this.code = code;
  }
}

function fixture(options = {}) {
  const calls = [];
  let role = options.role ?? "student";
  let inserts = 0;
  const client = {
    async query(sql, params) {
      const statement = sql.trim().split(/\s+/)[0];
      calls.push({ statement, sql, params });
      if (options.failAt === statement) throw new Error("SECRET_DATABASE_DETAIL");
      if (statement === "SELECT") return { rows: options.missing ? [] : [{ role, status: options.status ?? "active" }] };
      if (statement === "INSERT") {
        inserts++;
        if (options.insertError && (!options.failOnce || inserts === 1)) throw options.insertError;
        return {
          rowCount: options.insertCount ?? 1,
          rows: options.emptyInsertRows ? [] : [{ id: restaurantId, slug: params[3],
            operating_status: options.returnedStatus ?? "closed", delivery_token: "SECRET_TOKEN" }],
        };
      }
      if (statement === "UPDATE") return { rowCount: "updateCount" in options ? options.updateCount : 1, rows: [] };
      if (statement === "COMMIT") role = "seller";
      if (statement === "ROLLBACK" && options.rollbackFailure) throw new Error("SECRET_ROLLBACK_ERROR");
      return { rowCount: null, rows: [] };
    },
    release(discard) { calls.push({ statement: "RELEASE", discard }); },
  };
  const database = {
    DatabaseConfigurationError,
    getDatabasePool() {
      calls.push({ statement: "POOL" });
      if (options.noConfig) throw new DatabaseConfigurationError();
      if (options.badConfig) throw new DatabaseConfigurationError("DATABASE_CONFIGURATION_INVALID");
      return { async connect() {
        calls.push({ statement: "CONNECT" });
        if (options.connectFailure) throw new Error("SECRET_CONNECTION_STRING");
        return client;
      } };
    },
  };
  const service = load("../services/seller.service.ts", { "@/lib/database/server": database });
  return { ...service, calls, statements: () => calls.map((call) => call.statement) };
}

test("registration: one connection, lock before insert, conditional role update, minimal result", async () => {
  const f = fixture();
  const result = await f.SellerServices.register(userId, payload({ startClosed: false }));
  assert.deepEqual(f.statements(), ["POOL", "CONNECT", "BEGIN", "SELECT", "INSERT", "UPDATE", "COMMIT", "RELEASE"]);
  const select = f.calls.find((call) => call.statement === "SELECT");
  assert.match(select.sql, /WHERE id = \$1 FOR UPDATE/);
  assert.deepEqual(Array.from(select.params), [userId]);
  const insert = f.calls.find((call) => call.statement === "INSERT");
  assert.equal(insert.params[1], userId);
  assert.equal(insert.params[2], "Cơm Đậm Đà");
  assert.equal(insert.params[4], "Cơm ngon");
  assert.equal(insert.params[5], "KTX A");
  assert.equal(insert.params[6], null); // SQL NULL, không phải JSON "null".
  assert.match(insert.params[3], /^com-dam-da-[0-9a-f-]{36}$/);
  assert.match(insert.sql, /'closed'/);
  assert.ok(!insert.sql.split("VALUES")[0].match(/\bstatus\b/));
  assert.ok(!insert.sql.includes("Cơm"));
  assert.match(f.calls.find((call) => call.statement === "UPDATE").sql,
    /WHERE id = \$1 AND role = 'student' AND status = 'active'/);
  assert.deepEqual(Object.keys(result.restaurant).sort(), ["id", "operating_status", "slug"]);
  assert.equal(result.role, "seller");
  assert.equal(result.paymentSelectionPersisted, false);
  assert.match(result.message, /chưa được lưu hoặc áp dụng/);
  assert.ok(!JSON.stringify(result).includes("SECRET"));
  assert.equal(f.calls.at(-1).discard, false);
});

for (const mode of ["same", "daily"]) {
  test(`${mode} maps schedule to approved JSON without cash/bank or disabled days`, async () => {
    const f = fixture();
    await f.SellerServices.register(userId, payload({
      scheduleMode: mode, openTime: "10:00", closeTime: "14:00",
      days: [{ id: "mon", enabled: true, open: "11:00", close: "15:00" }, { id: "tue", enabled: false }],
    }));
    assert.deepEqual(JSON.parse(f.calls.find((call) => call.statement === "INSERT").params[6]), {
      version: 1, timezone: "Asia/Ho_Chi_Minh",
      days: { mon: mode === "same" ? { open: "10:00", close: "14:00" } : { open: "11:00", close: "15:00" } },
    });
  });
}

test("slug fallback and SQL injection text remain parameters", async () => {
  const f = fixture();
  const text = "'); DROP TABLE users; --";
  await f.SellerServices.register(userId, payload({ name: "🍚", description: text }));
  const insert = f.calls.find((call) => call.statement === "INSERT");
  assert.match(insert.params[3], /^quan-/);
  assert.equal(insert.params[4], text);
  assert.ok(!insert.sql.includes(text));
});

for (const patch of [{ name: " " }, { owner_id: "attacker" }, { role: "seller" }, { user_id: "attacker" }]) {
  test(`validation fails before pool access: ${JSON.stringify(patch)}`, async () => {
    const f = fixture();
    await assert.rejects(f.SellerServices.register(userId, payload(patch)), /SELLER_VALIDATION_ERROR/);
    assert.deepEqual(f.calls, []);
  });
}

for (const [options, code] of [
  [{ missing: true }, "PROFILE_NOT_FOUND"], [{ status: "inactive" }, "ACCOUNT_INACTIVE"],
  [{ role: "seller" }, "ROLE_CONFLICT"], [{ role: "staff" }, "ROLE_CONFLICT"],
]) {
  test(`profile rejected before insert: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await assert.rejects(f.SellerServices.register(userId, payload()), { message: code });
    assert.deepEqual(f.statements(), ["POOL", "CONNECT", "BEGIN", "SELECT", "ROLLBACK", "RELEASE"]);
  });
}

test("repeat after success returns conflict without creating another restaurant", async () => {
  const f = fixture();
  await f.SellerServices.register(userId, payload());
  await assert.rejects(f.SellerServices.register(userId, payload()), { message: "ROLE_CONFLICT" });
  assert.equal(f.statements().filter((s) => s === "INSERT").length, 1);
  assert.equal(f.statements().filter((s) => s === "RELEASE").length, 2);
});

for (const failAt of ["BEGIN", "SELECT", "INSERT", "UPDATE", "COMMIT"]) {
  test(`${failAt} failure is sanitized and connection released`, async () => {
    const f = fixture({ failAt });
    await assert.rejects(f.SellerServices.register(userId, payload()), { message: "REGISTRATION_FAILED" });
    assert.equal(f.calls.at(-1).statement, "RELEASE");
    assert.equal(f.statements().includes("ROLLBACK"), failAt !== "BEGIN");
    if (["BEGIN", "SELECT", "INSERT"].includes(failAt)) assert.ok(!f.statements().includes("UPDATE"));
  });
}

for (const updateCount of [0, 2, null]) {
  test(`update must affect exactly one user: ${updateCount}`, async () => {
    const f = fixture({ updateCount });
    await assert.rejects(f.SellerServices.register(userId, payload()), { message: "ROLE_CONFLICT" });
    assert.ok(f.statements().includes("ROLLBACK"));
    assert.ok(!f.statements().includes("COMMIT"));
  });
}
test("insert must return exactly one restaurant", async () => {
  const f = fixture({ insertCount: 0 });
  await assert.rejects(f.SellerServices.register(userId, payload()), /REGISTRATION_FAILED/);
  assert.ok(!f.statements().includes("UPDATE"));
});
for (const options of [{ emptyInsertRows: true }, { returnedStatus: "open" }]) {
  test(`unexpected inserted row must rollback before updating role: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await assert.rejects(f.SellerServices.register(userId, payload()), /REGISTRATION_FAILED/);
    assert.ok(f.statements().includes("ROLLBACK"));
    assert.ok(!f.statements().includes("UPDATE"));
  });
}

test("two concurrent requests with a simulated row lock recheck role after waiting (mock only)", async () => {
  let role = "student";
  let tail = Promise.resolve();
  let inserts = 0;
  let releases = 0;
  let connections = 0;
  const database = {
    DatabaseConfigurationError,
    getDatabasePool: () => ({ async connect() {
      connections++;
      let unlock;
      let updated = false;
      return {
        async query(sql, params) {
          if (sql.startsWith("SELECT")) {
            assert.match(sql, /FOR UPDATE/);
            const previous = tail;
            tail = new Promise((resolve) => { unlock = resolve; });
            await previous;
            return { rows: [{ role, status: "active" }] };
          }
          if (sql.startsWith("INSERT")) {
            inserts++;
            return { rowCount: 1, rows: [{ id: restaurantId, slug: params[3], operating_status: "closed" }] };
          }
          if (sql.startsWith("UPDATE")) {
            updated = true;
            return { rowCount: 1 };
          }
          if (sql === "COMMIT" || sql === "ROLLBACK") {
            if (sql === "COMMIT" && updated) role = "seller";
            unlock?.();
          }
          return { rows: [] };
        },
        release() { releases++; },
      };
    } }),
  };
  const { SellerServices } = load("../services/seller.service.ts", { "@/lib/database/server": database });
  const results = await Promise.allSettled([
    SellerServices.register(userId, payload()), SellerServices.register(userId, payload()),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.code, "ROLE_CONFLICT");
  assert.equal(inserts, 1);
  assert.equal(connections, 2);
  assert.equal(releases, 2);
});
test("rollback failure discards connection and does not retry slug", async () => {
  const f = fixture({ insertError: slugError(), rollbackFailure: true });
  await assert.rejects(f.SellerServices.register(userId, payload()), /REGISTRATION_FAILED/);
  assert.equal(f.calls.at(-1).discard, true);
  assert.equal(f.statements().filter((s) => s === "BEGIN").length, 1);
});
test("slug collision rolls back, rechecks user and retries on same connection", async () => {
  const f = fixture({ insertError: slugError(), failOnce: true });
  await f.SellerServices.register(userId, payload());
  assert.equal(f.statements().filter((s) => s === "CONNECT").length, 1);
  assert.equal(f.statements().filter((s) => s === "SELECT").length, 2);
  assert.equal(f.statements().filter((s) => s === "ROLLBACK").length, 1);
  const inserts = f.calls.filter((call) => call.statement === "INSERT");
  assert.notEqual(inserts[0].params[3], inserts[1].params[3]);
});
test("slug retry is bounded to three transactions", async () => {
  const f = fixture({ insertError: slugError() });
  await assert.rejects(f.SellerServices.register(userId, payload()), /SLUG_CONFLICT/);
  assert.equal(f.statements().filter((s) => s === "INSERT").length, 3);
  assert.equal(f.statements().filter((s) => s === "ROLLBACK").length, 3);
  assert.equal(f.statements().filter((s) => s === "RELEASE").length, 1);
});
for (const patch of [{ constraint: "restaurants_pkey" }, { table: "other" }, { schema: "other" }, { code: "42501" }]) {
  test(`does not retry unrelated DB error ${JSON.stringify(patch)}`, async () => {
    const f = fixture({ insertError: slugError(patch) });
    await assert.rejects(f.SellerServices.register(userId, payload()), /REGISTRATION_FAILED/);
    assert.equal(f.statements().filter((s) => s === "INSERT").length, 1);
  });
}
for (const [options, code] of [
  [{ noConfig: true }, "DATABASE_CONFIGURATION_MISSING"],
  [{ badConfig: true }, "DATABASE_CONFIGURATION_INVALID"],
  [{ connectFailure: true }, "REGISTRATION_FAILED"],
]) {
  test(`connection/config failure is controlled: ${code}`, async () => {
    const f = fixture(options);
    await assert.rejects(f.SellerServices.register(userId, payload()), { message: code });
    assert.ok(!f.statements().includes("BEGIN"));
    assert.ok(!f.statements().includes("RELEASE"));
  });
}

test("real pool helper is lazy, requires config, reuses pool and does not connect", () => {
  const created = [];
  class Pool {
    constructor(config) { created.push(config); }
    on() {}
    connect() { throw new Error("Must not connect in this test"); }
  }
  const env = {};
  const db = load("../lib/database/server.ts", { pg: { Pool } }, { process: { env } });
  assert.equal(created.length, 0);
  assert.throws(() => db.getDatabasePool(), /DATABASE_CONFIGURATION_MISSING/);
  env.DATABASE_URL = "  postgresql://placeholder.invalid/test  ";
  const pool = db.getDatabasePool();
  assert.equal(pool, db.getDatabasePool());
  assert.equal(created.length, 1);
  assert.equal(created[0].connectionString, "postgresql://placeholder.invalid/test?sslmode=verify-full");
});

for (const suffix of ["", "?sslmode=verify-full", "?sslmode=require", "?sslmode=prefer", "?sslmode=verify-ca&uselibpqcompat=true", "?ssl=true"]) {
  test(`pool config enables verified TLS in the real pg parser without connecting: ${suffix}`, () => {
    let config;
    class Pool {
      constructor(value) { config = value; }
      on() {}
    }
    const env = { DATABASE_URL: `postgresql://placeholder:placeholder@placeholder.invalid/test${suffix}` };
    const db = load("../lib/database/server.ts", { pg: { Pool } }, { process: { env } });
    db.getDatabasePool();
    assert.equal(new URL(config.connectionString).searchParams.get("sslmode"), "verify-full");
    // Chỉ tạo Client để kiểm tra parser của dependency thực tế; tuyệt đối không connect().
    const client = new Client(config);
    assert.ok(client.connectionParameters.ssl);
    assert.notEqual(client.connectionParameters.ssl.rejectUnauthorized, false);
    assert.equal(client.connectionParameters.ssl.checkServerIdentity, undefined);
  });
}
for (const value of [
  "not-a-url", "https://placeholder.invalid/test",
  "postgresql://placeholder.invalid/test?sslmode=disable",
  "postgresql://placeholder.invalid/test?sslmode=no-verify",
  "postgresql://placeholder.invalid/test?ssl=false",
  "postgresql://placeholder.invalid/test?ssl=0",
  "postgresql://placeholder.invalid/test?ssl=no-verify",
]) {
  test(`invalid or insecure DB config is rejected before creating a pool: ${value}`, () => {
    let created = false;
    class Pool { constructor() { created = true; } }
    const db = load("../lib/database/server.ts", { pg: { Pool } }, { process: { env: { DATABASE_URL: value } } });
    assert.throws(() => db.getDatabasePool(), { message: "DATABASE_CONFIGURATION_INVALID" });
    assert.equal(created, false);
  });
}

function apiFixture(options = {}) {
  const f = fixture(options);
  let authCalls = 0;
  const auth = { async createClient() { return { auth: { async getUser() {
    authCalls++;
    if (options.authThrow) throw new Error("SECRET_AUTH_ERROR");
    return { data: { user: options.unauthorized ? null : { id: userId } }, error: options.authError ? new Error("SECRET_AUTH_ERROR") : null };
  } } }; } };
  const route = load("../app/api/seller/register/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/supabase/server": auth,
    "@/services/seller.service": f,
  });
  const request = (body = JSON.stringify(payload()), origin = "https://example.com") => new Request(
    "https://example.com/api/seller/register", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body },
  );
  return { ...f, ...route, request, authCalls: () => authCalls };
}

test("API authenticates, calls real registration service and returns 201 without token", async () => {
  const f = apiFixture();
  assert.equal(f.runtime, "nodejs");
  const response = await f.POST(f.request());
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json();
  assert.equal(body.restaurant.operating_status, "closed");
  assert.equal(body.paymentSelectionPersisted, false);
  assert.equal(f.calls.find((call) => call.statement === "INSERT").params[1], userId);
  assert.ok(!JSON.stringify(body).includes("SECRET"));
});
test("API blocks foreign or missing origin before authentication", async () => {
  for (const origin of ["https://attacker.invalid", "", "null", "https://example.com.attacker.invalid", "http://example.com", "https://example.com:444"]) {
    const f = apiFixture();
    assert.equal((await f.POST(f.request(undefined, origin))).status, 403);
    assert.equal(f.authCalls(), 0);
    assert.deepEqual(f.calls, []);
  }
  const f = apiFixture();
  const request = f.request();
  request.headers.delete("origin");
  assert.equal((await f.POST(request)).status, 403);
  assert.equal(f.authCalls(), 0);
});
for (const options of [{ unauthorized: true }, { authError: true }]) {
  test(`API requires verified Auth user ${JSON.stringify(options)}`, async () => {
    const f = apiFixture(options);
    assert.equal((await f.POST(f.request())).status, 401);
    assert.deepEqual(f.calls, []);
  });
}
for (const body of ["not json", "null", "[]", JSON.stringify(payload({ name: "" })), JSON.stringify(payload({ owner_id: "attacker" }))]) {
  test(`API rejects invalid payload before DB: ${body}`, async () => {
    const f = apiFixture();
    assert.equal((await f.POST(f.request(body))).status, 400);
    assert.deepEqual(f.calls, []);
  });
}
for (const [options, status, code] of [
  [{ missing: true }, 403, "PROFILE_NOT_FOUND"], [{ status: "inactive" }, 403, "ACCOUNT_INACTIVE"],
  [{ role: "seller" }, 409, "ROLE_CONFLICT"], [{ role: "staff" }, 409, "ROLE_CONFLICT"],
  [{ insertError: slugError() }, 409, "SLUG_CONFLICT"],
  [{ noConfig: true }, 503, "DATABASE_CONFIGURATION_MISSING"],
  [{ badConfig: true }, 503, "DATABASE_CONFIGURATION_INVALID"],
  [{ failAt: "INSERT" }, 500, "REGISTRATION_FAILED"], [{ failAt: "UPDATE" }, 500, "REGISTRATION_FAILED"],
  [{ connectFailure: true }, 500, "REGISTRATION_FAILED"], [{ authThrow: true }, 500, "REGISTRATION_FAILED"],
]) {
  test(`API maps ${code} safely (${JSON.stringify(options)})`, async () => {
    const f = apiFixture(options);
    const response = await f.POST(f.request());
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const text = await response.text();
    assert.equal(JSON.parse(text).error.code, code);
    assert.ok(!text.includes("SECRET"));
  });
}
test("API repeat is 409 after success", async () => {
  const f = apiFixture();
  assert.equal((await f.POST(f.request())).status, 201);
  assert.equal((await f.POST(f.request())).status, 409);
  assert.equal(f.statements().filter((s) => s === "INSERT").length, 1);
});
