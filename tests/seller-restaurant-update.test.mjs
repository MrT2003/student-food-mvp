import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";

// Thực thi service/API thật; mọi DB/Auth đều mock, không đọc .env hoặc mở socket.
function load(file, mocks = {}) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, URL, require(id) {
    if (id === "server-only") return {};
    if (id === "@/lib/http/request-origin") return load("../lib/http/request-origin.ts");
    if (id === "node:crypto") return crypto;
    if (id in mocks) return mocks[id];
    if (id === "@/utilities/system.utility") return load("../utilities/system.utility.ts");
    throw new Error(`Unexpected import: ${id}`);
  } });
  return exports;
}
const userId = "11111111-1111-4111-8111-111111111111";
const restaurantId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const plain = (value) => JSON.parse(JSON.stringify(value));
class DatabaseConfigurationError extends Error {
  constructor(code = "DATABASE_CONFIGURATION_MISSING") { super(code); this.code = code; }
}

function fixture(options = {}) {
  const calls = [];
  const state = { id: restaurantId, owner_id: options.otherOwner ? otherId : userId,
    name: "Tên cũ", description: "Mô tả cũ", location: "KTX A", operating_hours: { legacy: true },
    slug: "slug-cu", operating_status: "paused", status: "inactive", delivery_token: "SECRET_TOKEN" };
  const database = {
    DatabaseConfigurationError,
    getDatabasePool() {
      calls.push({ kind: "POOL" });
      if (options.noConfig) throw new DatabaseConfigurationError();
      if (options.badConfig) throw new DatabaseConfigurationError("DATABASE_CONFIGURATION_INVALID");
      return { async connect() {
        calls.push({ kind: "CONNECT" });
        if (options.connectFailure) throw new Error("SECRET_CONNECTION_STRING");
        return {
          async query(sql, params) {
            const kind = sql.startsWith("SELECT role") ? "USER" : sql.startsWith("SELECT id") ? "OWNED" : sql.trim().split(/\s+/)[0];
            calls.push({ kind, sql, params });
            if (options.failAt === kind) throw new Error("SECRET_DB_ERROR");
            if (kind === "USER") return { rows: options.missingUser ? [] : [{ role: options.role ?? "seller", status: options.userStatus ?? "active" }] };
            if (kind === "OWNED") return { rows: !options.missingRestaurant && params[0] === state.id && params[1] === state.owner_id ? [{ id: state.id }] : [] };
            if (kind === "UPDATE") {
              for (const match of sql.matchAll(/\b(name|description|location|operating_hours) = \$(\d+)/g)) {
                const value = params[Number(match[2]) - 1];
                state[match[1]] = match[1] === "operating_hours" && value !== null ? JSON.parse(value) : value;
              }
              return { rowCount: "updateCount" in options ? options.updateCount : 1,
                rows: options.emptyRows ? [] : [{ ...state }] };
            }
            if (kind === "ROLLBACK" && options.rollbackFailure) throw new Error("SECRET_ROLLBACK_ERROR");
            return { rows: [] };
          },
          release(discard) { calls.push({ kind: "RELEASE", discard }); },
        };
      } };
    },
  };
  const service = load("../services/seller.service.ts", { "@/lib/database/server": database });
  return { ...service, calls, state, kinds: () => calls.map((call) => call.kind) };
}

for (const patch of [{ name: " Tên mới " }, { description: " Mô tả mới " }, { location: " KTX B " },
  { name: "Tên mới", location: "KTX B", description: "Mô tả mới" }]) {
  test(`updates exactly requested columns, keeps omitted fields/slug/status: ${JSON.stringify(patch)}`, async () => {
    const f = fixture();
    const before = structuredClone(f.state);
    const result = await f.SellerServices.updateRestaurant(userId, restaurantId, patch);
    assert.deepEqual(f.kinds(), ["POOL", "CONNECT", "BEGIN", "USER", "OWNED", "UPDATE", "COMMIT", "RELEASE"]);
    const user = f.calls.find((c) => c.kind === "USER");
    assert.match(user.sql, /WHERE id = \$1 FOR UPDATE/);
    assert.deepEqual(Array.from(user.params), [userId]);
    const owned = f.calls.find((c) => c.kind === "OWNED");
    assert.match(owned.sql, /WHERE id = \$1 AND owner_id = \$2 FOR UPDATE/);
    assert.deepEqual(Array.from(owned.params), [restaurantId, userId]);
    assert.ok(!owned.sql.includes("status"));
    const update = f.calls.find((c) => c.kind === "UPDATE");
    const setClause = update.sql.split("WHERE")[0];
    assert.match(update.sql, /WHERE id = \$\d+ AND owner_id = \$\d+/);
    assert.deepEqual(Array.from(update.params).slice(-2), [restaurantId, userId]);
    assert.match(setClause, /updated_at = now\(\)/);
    for (const field of ["name", "description", "location"]) {
      assert.equal(setClause.includes(`${field} =`), Object.hasOwn(patch, field));
      assert.equal(f.state[field], Object.hasOwn(patch, field) ? patch[field].trim() : before[field]);
    }
    for (const field of ["slug", "owner_id", "status", "operating_status", "operating_hours"]) assert.deepEqual(f.state[field], before[field]);
    assert.deepEqual(Object.keys(result.restaurant).sort(), ["description", "id", "location", "name", "operating_hours"]);
    assert.ok(!JSON.stringify(result).includes("SECRET"));
    assert.equal(f.calls.at(-1).discard, false);
  });
}

for (const [schedule, expected] of [
  [{ mode: "same", dayIds: ["mon", "fri"], openTime: "10:00", closeTime: "14:00" },
    { mon: { open: "10:00", close: "14:00" }, fri: { open: "10:00", close: "14:00" } }],
  [{ mode: "daily", days: [{ id: "tue", open: "09:00", close: "11:00" }, { id: "sun", open: "12:00", close: "15:00" }] },
    { tue: { open: "09:00", close: "11:00" }, sun: { open: "12:00", close: "15:00" } }],
  [{ mode: "later" }, null],
]) {
  test(`schedule ${schedule.mode} replaces the entire old JSON without changing status`, async () => {
    const f = fixture();
    await f.SellerServices.updateRestaurant(userId, restaurantId, { schedule });
    const update = f.calls.find((c) => c.kind === "UPDATE");
    const expectedHours = expected === null ? null : { version: 1, timezone: "Asia/Ho_Chi_Minh", days: expected };
    assert.deepEqual(f.state.operating_hours, expectedHours);
    assert.equal(update.params[0], expectedHours === null ? null : JSON.stringify(expectedHours));
    assert.match(update.sql, /operating_hours = \$1::jsonb/);
    assert.ok(!/\b(name|description|location|slug|status|operating_status)\s*=/.test(update.sql));
    assert.equal(f.state.operating_status, "paused");
    assert.equal(f.state.status, "inactive");
  });
}
test("multi-field PATCH with schedule uses correct parameter positions", async () => {
  const f = fixture();
  await f.SellerServices.updateRestaurant(userId, restaurantId, { name: "Mới", schedule: { mode: "later" } });
  const update = f.calls.find((c) => c.kind === "UPDATE");
  assert.deepEqual(Array.from(update.params), ["Mới", null, restaurantId, userId]);
  assert.match(update.sql, /WHERE id = \$3 AND owner_id = \$4/);
});
test("SQL injection text stays in parameters", async () => {
  const f = fixture();
  const value = "'); UPDATE users SET role='seller'; --";
  await f.SellerServices.updateRestaurant(userId, restaurantId, { name: value });
  const update = f.calls.find((c) => c.kind === "UPDATE");
  assert.equal(update.params[0], value);
  assert.ok(!update.sql.includes(value));
});

for (const body of [null, [], {}, "text", 1, true]) {
  test(`invalid PATCH payload rejects before DB: ${JSON.stringify(body)}`, async () => {
    const f = fixture();
    await assert.rejects(f.SellerServices.updateRestaurant(userId, restaurantId, body), /SELLER_VALIDATION_ERROR/);
    assert.deepEqual(f.calls, []);
  });
}
for (const [field, max] of [["name", 100], ["description", 300], ["location", 200]]) {
  for (const value of [undefined, null, [], {}, 1, true, "", " \t ", "x".repeat(max + 1)]) {
    test(`rejects ${field} ${JSON.stringify(value)}`, async () => {
      const f = fixture();
      await assert.rejects(f.SellerServices.updateRestaurant(userId, restaurantId, { [field]: value }), /SELLER_VALIDATION_ERROR/);
      assert.deepEqual(f.calls, []);
    });
  }
  test(`${field} exact max length and trimming match registration`, () => {
    const f = fixture();
    assert.equal(f.SellerServices.validateRestaurantUpdate({ [field]: "x".repeat(max) })[field].length, max);
    assert.equal(f.SellerServices.validateRestaurantUpdate({ [field]: "  Mới  " })[field], "Mới");
    assert.throws(() => f.SellerServices.validateRestaurantUpdate({ [field]: ` ${"x".repeat(max)} ` }), /SELLER_VALIDATION_ERROR/);
  });
}
for (const field of ["id", "owner_id", "user_id", "slug", "role", "status", "operating_status", "delivery_token",
  "delivery_token_updated_at", "created_at", "updated_at", "avatar_url", "cash", "bank", "scheduleMode", "extra"]) {
  test(`rejects field outside PATCH allowlist: ${field}`, async () => {
    const f = fixture();
    await assert.rejects(f.SellerServices.updateRestaurant(userId, restaurantId, { name: "Hợp lệ", [field]: "attacker" }), /SELLER_VALIDATION_ERROR/);
    assert.deepEqual(f.calls, []);
  });
}
for (const id of [null, undefined, 1, "bad", `${restaurantId}'`, restaurantId.replaceAll("-", "")]) {
  test(`invalid restaurantId ${id} rejects before DB`, async () => {
    const f = fixture();
    await assert.rejects(f.SellerServices.updateRestaurant(userId, id, { name: "Mới" }), /restaurantId/);
    assert.deepEqual(f.calls, []);
  });
}

for (const schedule of [null, [], {}, { mode: "unknown" }, { mode: "later", days: [] },
  { mode: "same" }, { mode: "same", dayIds: "mon", openTime: "10:00", closeTime: "14:00" },
  { mode: "same", dayIds: [], openTime: "10:00", closeTime: "14:00" },
  ...[["mon", "mon"], ["holiday"], [null], Array(8).fill("mon")].map((dayIds) => ({ mode: "same", dayIds, openTime: "10:00", closeTime: "14:00" })),
  ...[["23:00", "01:00"], ["10:00", "10:00"], ["9:00", "14:00"], ["24:00", "25:00"], [null, "14:00"]]
    .map(([openTime, closeTime]) => ({ mode: "same", dayIds: ["mon"], openTime, closeTime })),
  { mode: "same", dayIds: ["mon"], openTime: "10:00", closeTime: "14:00", owner_id: userId },
  { mode: "daily" }, { mode: "daily", days: [] }, { mode: "daily", days: "mon" },
  { mode: "daily", days: [null] }, { mode: "daily", days: [{ id: "mon" }] },
  { mode: "daily", days: [{ id: "mon", open: "10:00", close: "14:00", enabled: true }] },
  { mode: "daily", days: [{ id: "mon", open: "10:00", close: "09:00" }] },
  { mode: "daily", days: [{ id: "mon", open: "10:00", close: "14:00" }, { id: "mon", open: "11:00", close: "15:00" }] },
]) {
  test(`rejects incomplete/invalid normalized schedule ${JSON.stringify(schedule)}`, async () => {
    const f = fixture();
    await assert.rejects(f.SellerServices.updateRestaurant(userId, restaurantId, { schedule }), /SELLER_VALIDATION_ERROR/);
    assert.deepEqual(f.calls, []);
  });
}

for (const [options, code] of [
  [{ missingUser: true }, "PROFILE_NOT_FOUND"], [{ userStatus: "inactive" }, "ACCOUNT_INACTIVE"],
  [{ role: "student" }, "SELLER_REQUIRED"], [{ role: "staff" }, "SELLER_REQUIRED"],
  [{ missingRestaurant: true }, "RESTAURANT_NOT_FOUND"], [{ otherOwner: true }, "RESTAURANT_NOT_FOUND"],
  [{ updateCount: 0 }, "RESTAURANT_NOT_FOUND"], [{ updateCount: 2 }, "UPDATE_FAILED"],
  [{ updateCount: null }, "UPDATE_FAILED"], [{ emptyRows: true }, "UPDATE_FAILED"],
]) {
  test(`authorization/row count rejects safely: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await assert.rejects(f.SellerServices.updateRestaurant(userId, restaurantId, { name: "Mới" }), { message: code });
    assert.equal(f.calls.at(-1).kind, "RELEASE");
    assert.ok(f.kinds().includes("ROLLBACK"));
    assert.ok(!f.kinds().includes("COMMIT"));
    if (options.missingRestaurant || options.otherOwner || options.missingUser || options.userStatus || options.role) {
      assert.ok(!f.kinds().includes("UPDATE"));
    }
    if (options.missingUser || options.userStatus || options.role) assert.ok(!f.kinds().includes("OWNED"));
  });
}
for (const failAt of ["BEGIN", "USER", "OWNED", "UPDATE", "COMMIT"]) {
  test(`DB error at ${failAt} sanitized, rollback/release appropriate`, async () => {
    const f = fixture({ failAt });
    await assert.rejects(f.SellerServices.updateRestaurant(userId, restaurantId, { name: "Mới" }), { message: "UPDATE_FAILED" });
    assert.equal(f.kinds().includes("ROLLBACK"), failAt !== "BEGIN");
    assert.equal(f.calls.at(-1).kind, "RELEASE");
  });
}
test("rollback failure discards connection", async () => {
  const f = fixture({ missingRestaurant: true, rollbackFailure: true });
  await assert.rejects(f.SellerServices.updateRestaurant(userId, restaurantId, { name: "Mới" }), /UPDATE_FAILED/);
  assert.equal(f.calls.at(-1).discard, true);
});
for (const [options, code] of [[{ noConfig: true }, "DATABASE_CONFIGURATION_MISSING"], [{ badConfig: true }, "DATABASE_CONFIGURATION_INVALID"], [{ connectFailure: true }, "UPDATE_FAILED"]]) {
  test(`controlled connection error ${code}`, async () => {
    const f = fixture(options);
    await assert.rejects(f.SellerServices.updateRestaurant(userId, restaurantId, { name: "Mới" }), { message: code });
    assert.ok(!f.kinds().includes("BEGIN"));
  });
}

function apiFixture(options = {}) {
  const f = fixture(options);
  let authCalls = 0;
  const route = load("../app/api/seller/restaurants/[restaurantId]/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/services/seller.service": f,
    "@/lib/supabase/server": { async createClient() { return { auth: { async getUser() {
      authCalls++;
      if (options.authThrow) throw new Error("SECRET_AUTH_ERROR");
      return { data: { user: options.unauthorized ? null : { id: userId } }, error: options.authError ? new Error("SECRET_AUTH_ERROR") : null };
    } } }; } },
  });
  return { ...f, ...route, authCalls: () => authCalls,
    request(body = JSON.stringify({ name: "Tên mới" }), origin = "https://example.com") {
      return new Request(`https://example.com/api/seller/restaurants/${restaurantId}`, {
        method: "PATCH", headers: { origin, "Content-Type": "application/json" }, body,
      });
    },
    context(id = restaurantId) { return { params: Promise.resolve({ restaurantId: id }) }; },
  };
}
test("API awaits params, authenticates session owner, returns only public update fields", async () => {
  const f = apiFixture();
  assert.equal(f.runtime, "nodejs");
  const response = await f.PATCH(f.request(), f.context());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(Object.keys((await response.json()).restaurant).sort(), ["description", "id", "location", "name", "operating_hours"]);
  assert.equal(f.calls.find((c) => c.kind === "OWNED").params[1], userId);
});
test("API blocks missing/foreign/null/lookalike Origin before auth", async () => {
  for (const origin of [null, "https://example.com.attacker.invalid", "null", "http://example.com", "https://example.com:444"]) {
    const f = apiFixture();
    const request = f.request();
    if (origin === null) request.headers.delete("origin"); else request.headers.set("origin", origin);
    assert.equal((await f.PATCH(request, f.context())).status, 403);
    assert.equal(f.authCalls(), 0);
    assert.deepEqual(f.calls, []);
  }
});
for (const options of [{ unauthorized: true }, { authError: true }]) {
  test(`API rejects unverified session ${JSON.stringify(options)}`, async () => {
    const f = apiFixture(options);
    assert.equal((await f.PATCH(f.request(), f.context())).status, 401);
    assert.deepEqual(f.calls, []);
  });
}
for (const [body, id] of [["not json", restaurantId], ["{}", restaurantId], ["null", restaurantId], ["[]", restaurantId],
  [JSON.stringify({ owner_id: otherId }), restaurantId], [JSON.stringify({ name: "Mới" }), "bad-id"]]) {
  test(`API rejects invalid JSON/body/id before DB: ${body}/${id}`, async () => {
    const f = apiFixture();
    assert.equal((await f.PATCH(f.request(body), f.context(id))).status, 400);
    assert.deepEqual(f.calls, []);
  });
}
for (const [options, status, code] of [
  [{ missingUser: true }, 403, "PROFILE_NOT_FOUND"], [{ userStatus: "inactive" }, 403, "ACCOUNT_INACTIVE"],
  [{ role: "student" }, 403, "SELLER_REQUIRED"], [{ role: "staff" }, 403, "SELLER_REQUIRED"],
  [{ missingRestaurant: true }, 404, "RESTAURANT_NOT_FOUND"], [{ otherOwner: true }, 404, "RESTAURANT_NOT_FOUND"],
  [{ updateCount: 0 }, 404, "RESTAURANT_NOT_FOUND"], [{ failAt: "UPDATE" }, 500, "UPDATE_FAILED"],
  [{ noConfig: true }, 503, "DATABASE_CONFIGURATION_MISSING"], [{ badConfig: true }, 503, "DATABASE_CONFIGURATION_INVALID"],
  [{ authThrow: true }, 500, "UPDATE_FAILED"],
]) {
  test(`API maps ${code}: ${JSON.stringify(options)}`, async () => {
    const f = apiFixture(options);
    const response = await f.PATCH(f.request(), f.context());
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const text = await response.text();
    assert.equal(JSON.parse(text).error.code, code);
    assert.ok(!text.includes("SECRET"));
  });
}
test("foreign restaurant and absent restaurant have identical API response", async () => {
  const missing = apiFixture({ missingRestaurant: true });
  const foreign = apiFixture({ otherOwner: true });
  const a = await missing.PATCH(missing.request(), missing.context());
  const b = await foreign.PATCH(foreign.request(), foreign.context());
  assert.equal(await a.text(), await b.text());
});
test("validation returns a fresh normalized patch", () => {
  const f = fixture();
  const input = { name: " Mới ", schedule: { mode: "same", dayIds: ["mon"], openTime: "10:00", closeTime: "14:00" } };
  const before = structuredClone(input);
  const result = f.SellerServices.validateRestaurantUpdate(input);
  assert.deepEqual(plain(result), { ...input, name: "Mới" });
  result.schedule.dayIds.push("sun");
  assert.deepEqual(input, before);
});
