import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";
import {Client} from "pg";
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
