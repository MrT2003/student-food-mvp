import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";

// Module thật, Auth/DB mock. Không đọc .env, không mở kết nối hoặc log dữ liệu ngân hàng.
function load(file, mocks = {}) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const noLog = () => { throw new Error("Must not log banking data"); };
  vm.runInNewContext(output, { exports, URL, console: { log: noLog, error: noLog, warn: noLog }, require(id) {
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
const bankId = "33333333-3333-4333-8333-333333333333";
const oldId = "44444444-4444-4444-8444-444444444444";
const foreignBank = "55555555-5555-4555-8555-555555555555";
const otherRestaurant = "66666666-6666-4666-8666-666666666666";
const valid = (patch = {}) => ({ bank_name: " Ngân hàng mẫu ", account_no: " 001 2-3 ", account_name: " NGUYEN VAN A ", ...patch });
const duplicate = (patch = {}) => Object.assign(new Error("SECRET_DB_ACCOUNT_DETAILS"), {
  code: "23505", schema: "public", table: "restaurant_banks", constraint: "uq_restaurant_banks_account", ...patch,
});
class DatabaseConfigurationError extends Error {
  constructor(code = "DATABASE_CONFIGURATION_MISSING") { super(code); this.code = code; }
}

function fixture(options = {}) {
  const calls = [];
  let banks = [
    { id: bankId, restaurant_id: restaurantId, bank_name: "Cũ", account_no: "0001", account_name: "CHU CU", is_default: !!options.targetDefault },
    { id: oldId, restaurant_id: restaurantId, bank_name: "Mặc định cũ", account_no: "0002", account_name: "CHU CU", is_default: !options.targetDefault },
    { id: foreignBank, restaurant_id: otherRestaurant, bank_name: "SECRET_FOREIGN_BANK", account_no: "SECRET_FOREIGN_ACCOUNT", account_name: "SECRET_FOREIGN_NAME", is_default: true },
  ];
  if (options.noLocalBanks) banks = banks.filter((b) => b.restaurant_id !== restaurantId);
  let snapshot;
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
            const kind = sql.startsWith("SELECT role") ? "USER"
              : sql.startsWith("SELECT id FROM public.restaurants ") ? "RESTAURANT"
              : sql.startsWith("SELECT id FROM public.restaurant_banks ") ? "BANK"
              : sql.startsWith("UPDATE") && sql.includes("SET is_default = false,") ? "DEMOTE"
              : sql.trim().split(/\s+/)[0];
            calls.push({ kind, sql, params });
            if (options.failAt === kind) throw new Error("SECRET_QUERY_ERROR");
            if (kind === "BEGIN") snapshot = structuredClone(banks);
            if (kind === "USER") return { rows: options.missingUser ? [] : [{ role: options.role ?? "seller", status: options.userStatus ?? "active" }] };
            if (kind === "RESTAURANT") return { rows: options.missingRestaurant || options.notOwner ? [] : [{ id: params[0] }] };
            if (kind === "BANK") return { rows: options.missingBank ? [] : banks.filter((b) => b.id === params[0] && b.restaurant_id === params[1]).map((b) => ({ id: b.id })) };
            if (kind === "DEMOTE") {
              for (const b of banks) if (b.restaurant_id === params[0] && b.id !== params[1]) b.is_default = false;
            }
            if (kind === "INSERT" || kind === "UPDATE") {
              if (options.writeError) throw options.writeError;
              let row;
              if (kind === "INSERT") {
                row = { id: params[0], restaurant_id: params[1], bank_name: params[2], account_no: params[3], account_name: params[4], is_default: params[5] };
                banks.push(row);
              } else {
                row = banks.find((b) => b.id === params.at(-2) && b.restaurant_id === params.at(-1));
                for (const match of sql.matchAll(/\b(bank_name|account_no|account_name|is_default) = \$(\d+)/g)) row[match[1]] = params[Number(match[2]) - 1];
              }
              return { rowCount: "writeCount" in options ? options.writeCount : 1,
                rows: options.emptyRows ? [] : [{ ...row, user: "SECRET_USER", delivery_token: "SECRET_TOKEN" }] };
            }
            if (kind === "ROLLBACK") {
              if (options.rollbackFailure) throw new Error("SECRET_ROLLBACK_ERROR");
              banks = snapshot;
            }
            return { rows: [] };
          },
          release(discard) { calls.push({ kind: "RELEASE", discard }); },
        };
      } };
    },
  };
  const service = load("../services/seller.service.ts", { "@/lib/database/server": database });
  return { ...service, calls, kinds: () => calls.map((c) => c.kind), banks: () => structuredClone(banks) };
}
function execute(f, mode, input, rest = restaurantId, bank = bankId) {
  return mode === "create" ? f.SellerServices.createRestaurantBank(userId, rest, input)
    : f.SellerServices.updateRestaurantBank(userId, rest, bank, input);
}

test("POST trims only edges, preserves account string/leading zeroes, defaults false and returns allowlist", async () => {
  const f = fixture();
  const result = await execute(f, "create", valid());
  assert.deepEqual(f.kinds(), ["POOL", "CONNECT", "BEGIN", "USER", "RESTAURANT", "INSERT", "COMMIT", "RELEASE"]);
  assert.equal(result.bank.account_no, "001 2-3");
  assert.equal(result.bank.bank_name, "Ngân hàng mẫu");
  assert.equal(result.bank.account_name, "NGUYEN VAN A");
  assert.equal(result.bank.is_default, false);
  assert.equal(result.bank.restaurant_id, restaurantId);
  assert.deepEqual(Object.keys(result.bank).sort(), ["account_name", "account_no", "bank_name", "id", "is_default", "restaurant_id"]);
  assert.ok(!JSON.stringify(result).includes("SECRET"));
  assert.equal(f.calls.find((c) => c.kind === "RESTAURANT").params[1], userId);
  assert.ok(!f.calls.find((c) => c.kind === "INSERT").sql.includes("001"));
});
test("POST first account is not automatically default", async () => {
  const f = fixture({ noLocalBanks: true });
  const result = await execute(f, "create", valid());
  assert.equal(result.bank.is_default, false);
  assert.equal(f.banks().filter((b) => b.restaurant_id === restaurantId).length, 1);
  assert.ok(!f.kinds().includes("DEMOTE"));
});
for (const patch of [{ bank_name: " Mới " }, { account_no: " 00007 " }, { account_name: " CHU MOI " },
  { is_default: false }, { bank_name: "Mới", account_no: "0010", account_name: "CHU MOI" }]) {
  test(`PATCH updates only supplied fields: ${JSON.stringify(patch)}`, async () => {
    const f = fixture({ targetDefault: true });
    const before = f.banks()[0];
    const result = await execute(f, "update", patch);
    assert.deepEqual(f.kinds(), ["POOL", "CONNECT", "BEGIN", "USER", "RESTAURANT", "BANK", "UPDATE", "COMMIT", "RELEASE"]);
    const update = f.calls.find((c) => c.kind === "UPDATE");
    assert.deepEqual(Array.from(update.params).slice(-2), [bankId, restaurantId]);
    assert.match(update.sql, /WHERE id = \$\d+ AND restaurant_id = \$\d+/);
    for (const field of ["bank_name", "account_no", "account_name", "is_default"]) {
      assert.equal(update.sql.split("WHERE")[0].includes(`${field} =`), Object.hasOwn(patch, field));
      assert.equal(result.bank[field], Object.hasOwn(patch, field) ? typeof patch[field] === "string" ? patch[field].trim() : patch[field] : before[field]);
    }
    assert.ok(!f.kinds().includes("DEMOTE"));
  });
}
for (const mode of ["create", "update"]) {
  test(`${mode} setting default demotes own siblings first; other restaurant unchanged`, async () => {
    const f = fixture();
    const foreignBefore = f.banks().find((b) => b.id === foreignBank);
    const result = await execute(f, mode, mode === "create" ? valid({ is_default: true }) : { is_default: true });
    assert.equal(result.bank.is_default, true);
    assert.ok(f.kinds().indexOf("RESTAURANT") < f.kinds().indexOf("DEMOTE"));
    if (mode === "update") assert.ok(f.kinds().indexOf("BANK") < f.kinds().indexOf("DEMOTE"));
    assert.ok(f.kinds().indexOf("DEMOTE") < f.kinds().indexOf(mode === "create" ? "INSERT" : "UPDATE"));
    const demote = f.calls.find((c) => c.kind === "DEMOTE");
    assert.match(demote.sql, /WHERE restaurant_id = \$1 AND is_default = true/);
    assert.equal(demote.params[0], restaurantId);
    if (mode === "update") { assert.match(demote.sql, /AND id <> \$2/); assert.equal(demote.params[1], bankId); }
    assert.equal(f.banks().filter((b) => b.restaurant_id === restaurantId && b.is_default).length, 1);
    assert.deepEqual(f.banks().find((b) => b.id === foreignBank), foreignBefore);
    assert.ok(f.calls.filter((c) => ["USER", "RESTAURANT", "BANK"].includes(c.kind)).every((c) => c.sql.includes("FOR UPDATE")));
  });
  test(`${mode} failure after demotion rolls back previous defaults in mock`, async () => {
    const f = fixture({ writeError: duplicate() });
    const before = f.banks();
    await assert.rejects(execute(f, mode, mode === "create" ? valid({ is_default: true }) : { is_default: true }), /BANK_ACCOUNT_CONFLICT/);
    assert.ok(f.kinds().includes("DEMOTE"));
    assert.ok(f.kinds().includes("ROLLBACK"));
    assert.ok(!f.kinds().includes("COMMIT"));
    assert.deepEqual(f.banks(), before);
    assert.equal(f.calls.at(-1).kind, "RELEASE");
    assert.equal(f.kinds().filter((k) => k === "CONNECT").length, 1);
  });
}
test("PATCH false may leave no default and does not choose another", async () => {
  const f = fixture({ targetDefault: true });
  await execute(f, "update", { is_default: false });
  assert.equal(f.banks().filter((b) => b.restaurant_id === restaurantId && b.is_default).length, 0);
});
for (const mode of ["create", "update"]) {
  for (const body of [null, [], {}, "text", 1, true]) {
    test(`${mode} rejects payload ${JSON.stringify(body)} before DB`, async () => {
      const f = fixture();
      await assert.rejects(execute(f, mode, body), /SELLER_VALIDATION_ERROR/);
      assert.deepEqual(f.calls, []);
    });
  }
  for (const field of ["bank_name", "account_no", "account_name"]) {
    if (mode === "create") test(`POST requires ${field}`, async () => {
      const f = fixture(); const body = valid(); delete body[field];
      await assert.rejects(execute(f, mode, body), /SELLER_VALIDATION_ERROR/);
      assert.deepEqual(f.calls, []);
    });
    for (const value of [undefined, null, 123, [], {}, false, "", " \t "]) {
      test(`${mode} rejects invalid ${field}: ${JSON.stringify(value)}`, async () => {
        const f = fixture();
        await assert.rejects(execute(f, mode, mode === "create" ? valid({ [field]: value }) : { [field]: value }), /SELLER_VALIDATION_ERROR/);
        assert.deepEqual(f.calls, []);
      });
    }
  }
  for (const value of [null, undefined, "true", "false", 0, 1, [], {}]) {
    test(`${mode} rejects non-boolean is_default ${JSON.stringify(value)}`, async () => {
      const f = fixture();
      await assert.rejects(execute(f, mode, mode === "create" ? valid({ is_default: value }) : { is_default: value }), /SELLER_VALIDATION_ERROR/);
    });
  }
  for (const field of ["id", "restaurant_id", "owner_id", "user_id", "role", "created_at", "updated_at", "cash", "bank", "extra"]) {
    test(`${mode} rejects field outside contract ${field}`, async () => {
      const f = fixture();
      await assert.rejects(execute(f, mode, { ...valid(), [field]: "attacker" }), /SELLER_VALIDATION_ERROR/);
      assert.deepEqual(f.calls, []);
    });
  }
  for (const id of [null, 1, "bad", restaurantId.replaceAll("-", "")]) {
    test(`${mode} rejects restaurant UUID ${id}`, async () => {
      const f = fixture();
      await assert.rejects(execute(f, mode, valid(), id), /restaurantId/);
      assert.deepEqual(f.calls, []);
    });
  }
}
for (const id of [null, 1, "bad", `${bankId}'`]) {
  test(`PATCH rejects bank UUID ${id}`, async () => {
    const f = fixture();
    await assert.rejects(execute(f, "update", { is_default: true }, restaurantId, id), /bankId/);
    assert.deepEqual(f.calls, []);
  });
}
test("varchar has no invented maximum and account characters are not rewritten", () => {
  const f = fixture();
  const body = valid({ bank_name: "x".repeat(2000) });
  assert.equal(f.SellerServices.validateBankCreate(body).bank_name.length, 2000);
  assert.equal(f.SellerServices.validateBankCreate(body).account_no, "001 2-3");
});

for (const mode of ["create", "update"]) {
  for (const [options, code] of [
    [{ missingUser: true }, "PROFILE_NOT_FOUND"], [{ userStatus: "inactive" }, "ACCOUNT_INACTIVE"],
    [{ role: "student" }, "SELLER_REQUIRED"], [{ role: "staff" }, "SELLER_REQUIRED"],
    [{ missingRestaurant: true }, "RESTAURANT_NOT_FOUND"], [{ notOwner: true }, "RESTAURANT_NOT_FOUND"],
  ]) {
    test(`${mode} verifies seller/owner before any writes ${JSON.stringify(options)}`, async () => {
      const f = fixture(options);
      await assert.rejects(execute(f, mode, valid({ is_default: true })), { message: code });
      assert.ok(!f.kinds().some((k) => ["DEMOTE", "INSERT", "UPDATE"].includes(k)));
      assert.ok(f.kinds().includes("ROLLBACK"));
      assert.equal(f.calls.at(-1).kind, "RELEASE");
    });
  }
  for (const failAt of ["BEGIN", "USER", "RESTAURANT", "DEMOTE", mode === "create" ? "INSERT" : "UPDATE", "COMMIT"]) {
    test(`${mode} query error at ${failAt} sanitized, rollback/release appropriate`, async () => {
      const f = fixture({ failAt });
      await assert.rejects(execute(f, mode, valid({ is_default: true })), { message: "BANK_WRITE_FAILED" });
      assert.equal(f.kinds().includes("ROLLBACK"), failAt !== "BEGIN");
      assert.equal(f.calls.at(-1).kind, "RELEASE");
    });
  }
  for (const writeCount of [0, 2, null]) {
    test(`${mode} requires exactly one affected row: ${writeCount}`, async () => {
      const f = fixture({ writeCount });
      await assert.rejects(execute(f, mode, valid()), { message: mode === "update" && writeCount === 0 ? "BANK_NOT_FOUND" : "BANK_WRITE_FAILED" });
      assert.ok(f.kinds().includes("ROLLBACK"));
      assert.ok(!f.kinds().includes("COMMIT"));
    });
  }
  for (const patch of [{}, { constraint: "uq_restaurant_banks_one_default" }, { constraint: "restaurant_banks_pkey" }, { table: "other" }, { schema: "other" }, { code: "42501" }]) {
    test(`${mode} maps only account constraint as duplicate: ${JSON.stringify(patch)}`, async () => {
      const f = fixture({ writeError: duplicate(patch) });
      const before = f.banks();
      await assert.rejects(execute(f, mode, valid()), { message: Object.keys(patch).length ? "BANK_WRITE_FAILED" : "BANK_ACCOUNT_CONFLICT" });
      assert.deepEqual(f.banks(), before);
      assert.equal(f.kinds().filter((k) => k === "CONNECT").length, 1);
      assert.ok(!f.calls.some((c) => /UPSERT|ON CONFLICT|DELETE/.test(c.sql ?? "")));
    });
  }
  for (const [options, code] of [[{ noConfig: true }, "DATABASE_CONFIGURATION_MISSING"], [{ badConfig: true }, "DATABASE_CONFIGURATION_INVALID"], [{ connectFailure: true }, "BANK_WRITE_FAILED"]]) {
    test(`${mode} configuration/connection failure ${code}`, async () => {
      const f = fixture(options);
      await assert.rejects(execute(f, mode, valid()), { message: code });
      assert.ok(!f.kinds().includes("BEGIN"));
    });
  }
}
for (const target of [bankId, foreignBank]) {
  test(`PATCH verifies target before demoting anything: ${target}`, async () => {
    const f = fixture({ missingBank: target === bankId });
    await assert.rejects(execute(f, "update", { is_default: true }, restaurantId, target), /BANK_NOT_FOUND/);
    assert.ok(!f.kinds().includes("DEMOTE"));
    assert.ok(!f.kinds().includes("UPDATE"));
    const lock = f.calls.find((c) => c.kind === "BANK");
    assert.deepEqual(Array.from(lock.params), [target, restaurantId]);
    assert.match(lock.sql, /WHERE id = \$1 AND restaurant_id = \$2 FOR UPDATE/);
  });
}
test("rollback failure discards connection", async () => {
  const f = fixture({ writeError: duplicate(), rollbackFailure: true });
  await assert.rejects(execute(f, "create", valid({ is_default: true })), /BANK_WRITE_FAILED/);
  assert.equal(f.calls.at(-1).discard, true);
});
test("PATCH target lock error rolls back before demoting any default", async () => {
  const f = fixture({ failAt: "BANK" });
  await assert.rejects(execute(f, "update", { is_default: true }), /BANK_WRITE_FAILED/);
  assert.ok(!f.kinds().includes("DEMOTE"));
  assert.ok(f.kinds().includes("ROLLBACK"));
  assert.equal(f.calls.at(-1).kind, "RELEASE");
});
test("SQL injection stays a parameter; no user/restaurant/payment UPDATE exists", async () => {
  const f = fixture();
  const value = "001'); UPDATE users SET role='seller'; --";
  await execute(f, "update", { account_no: value });
  const update = f.calls.find((c) => c.kind === "UPDATE");
  assert.equal(update.params[0], value);
  assert.ok(!update.sql.includes(value));
  assert.ok(f.calls.every((c) => !/UPDATE public\.(users|restaurants)\b/.test(c.sql ?? "")));
});

function apiFixture(mode, options = {}) {
  const f = fixture(options);
  let authCalls = 0;
  const handler = load("../app/api/seller/restaurants/[restaurantId]/banks/_handler.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/services/seller.service": f,
    "@/lib/supabase/server": { async createClient() { return { auth: { async getUser() {
      authCalls++;
      if (options.authThrow) throw new Error("SECRET_AUTH_ERROR");
      return { data: { user: options.unauthorized ? null : { id: userId } }, error: options.authError ? new Error("SECRET_AUTH_ERROR") : null };
    } } }; } },
  });
  const route = mode === "create" ? load("../app/api/seller/restaurants/[restaurantId]/banks/route.ts", { "./_handler": handler })
    : load("../app/api/seller/restaurants/[restaurantId]/banks/[bankId]/route.ts", { "../_handler": handler });
  const method = mode === "create" ? "POST" : "PATCH";
  return { ...f, route, authCalls: () => authCalls,
    request(body = JSON.stringify(valid())) { return new Request(`https://example.com/api/seller/restaurants/${restaurantId}/banks`, {
      method, headers: { origin: "https://example.com", "Content-Type": "application/json" }, body,
    }); },
    call(request, rest = restaurantId, bank = bankId) { return route[method](request, { params: Promise.resolve({ restaurantId: rest, bankId: bank }) }); },
  };
}
for (const mode of ["create", "update"]) {
  test(`${mode} endpoint invokes real service and returns safe bank result`, async () => {
    const f = apiFixture(mode);
    assert.equal(f.route.runtime, "nodejs");
    assert.deepEqual(Object.keys(f.route).sort(), [mode === "create" ? "POST" : "PATCH", "runtime"]);
    const response = await f.call(f.request());
    assert.equal(response.status, mode === "create" ? 201 : 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const text = await response.text();
    assert.equal(JSON.parse(text).bank.restaurant_id, restaurantId);
    assert.ok(!text.includes("SECRET"));
  });
  test(`${mode} rejects invalid Origin before Auth`, async () => {
    for (const origin of [null, "null", "https://example.com.attacker.invalid", "http://example.com", "https://example.com:444"]) {
      const f = apiFixture(mode); const request = f.request();
      if (origin === null) request.headers.delete("origin"); else request.headers.set("origin", origin);
      assert.equal((await f.call(request)).status, 403);
      assert.equal(f.authCalls(), 0);
      assert.deepEqual(f.calls, []);
    }
  });
  for (const options of [{ unauthorized: true }, { authError: true }]) {
    test(`${mode} requires verified Auth ${JSON.stringify(options)}`, async () => {
      const f = apiFixture(mode, options);
      assert.equal((await f.call(f.request())).status, 401);
      assert.deepEqual(f.calls, []);
    });
  }
  for (const body of ["bad json", "null", "[]", "{}", JSON.stringify({ owner_id: userId }), JSON.stringify(valid({ account_no: 123 }))]) {
    test(`${mode} API rejects invalid JSON/body before DB ${body}`, async () => {
      const f = apiFixture(mode);
      assert.equal((await f.call(f.request(body))).status, 400);
      assert.deepEqual(f.calls, []);
    });
  }
  test(`${mode} API validates route UUID`, async () => {
    const f = apiFixture(mode);
    assert.equal((await f.call(f.request(), "bad-id")).status, 400);
    if (mode === "update") assert.equal((await f.call(f.request(), restaurantId, "bad-id")).status, 400);
    assert.deepEqual(f.calls, []);
  });
  for (const [options, status, code] of [
    [{ missingUser: true }, 403, "PROFILE_NOT_FOUND"], [{ userStatus: "inactive" }, 403, "ACCOUNT_INACTIVE"],
    [{ role: "student" }, 403, "SELLER_REQUIRED"], [{ role: "staff" }, 403, "SELLER_REQUIRED"],
    [{ missingRestaurant: true }, 404, "RESTAURANT_NOT_FOUND"], [{ notOwner: true }, 404, "RESTAURANT_NOT_FOUND"],
    [{ writeError: duplicate() }, 409, "BANK_ACCOUNT_CONFLICT"], [{ writeError: duplicate({ constraint: "uq_restaurant_banks_one_default" }) }, 500, "BANK_WRITE_FAILED"],
    [{ noConfig: true }, 503, "DATABASE_CONFIGURATION_MISSING"], [{ badConfig: true }, 503, "DATABASE_CONFIGURATION_INVALID"],
    [{ authThrow: true }, 500, "BANK_WRITE_FAILED"],
  ]) {
    test(`${mode} API error ${code}: ${JSON.stringify(options)}`, async () => {
      const f = apiFixture(mode, options);
      const response = await f.call(f.request());
      assert.equal(response.status, status);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      const text = await response.text();
      assert.equal(JSON.parse(text).error.code, code);
      assert.ok(!text.includes("SECRET"));
    });
  }
}
test("PATCH absent bank and bank of another restaurant have identical safe 404", async () => {
  const f = apiFixture("update", { missingBank: true });
  const g = apiFixture("update");
  const a = await f.call(f.request()); const b = await g.call(g.request(), restaurantId, foreignBank);
  assert.equal(a.status, 404); assert.equal(b.status, 404);
  assert.equal(await a.text(), await b.text());
  assert.ok(!g.kinds().includes("DEMOTE"));
});
