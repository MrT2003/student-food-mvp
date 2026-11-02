import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";

export const userId = "11111111-1111-4111-8111-111111111111";
export const restaurantId = "22222222-2222-4222-8222-222222222222";
export const bankId = "33333333-3333-4333-8333-333333333333";
export const other = "44444444-4444-4444-8444-444444444444";
// Synthetic unit-test input only; never use an actual account PIN in tests/output.
export const testPin = () => String(1).padStart(4, "0");
export function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(output, { exports, URL, Buffer, Date,
    console: { error() { throw new Error("Must not log private data"); } },
    require(id) {
      if (id === "server-only") return {};
      if (id === "node:crypto") return crypto;
      if (id in mocks) return mocks[id];
      if (id === "@/lib/database/server") return { DatabaseConfigurationError: class extends Error {}, getDatabasePool() { throw new Error("PG_MUST_NOT_BE_USED"); } };
      if (id === "@/utilities/system.utility") return load("../utilities/system.utility.ts");
      if (id === "@/lib/http/request-origin") return load("../lib/http/request-origin.ts");
      throw new Error(`Unexpected import: ${id}`);
    }, ...globals });
  return exports;
}

export function fixture(options = {}) {
  const calls = [];
  let currentRole = options.role ?? "seller";
  let rpcTail = Promise.resolve();
  const state = {
    restaurant: { id: restaurantId, owner_id: userId, name: "Quán cũ", description: "Mô tả", location: "KTX", slug: "original-slug", status: "inactive", operating_status: "paused", operating_hours: { legacy: true }, delivery_token: "PRIVATE" },
    banks: [{ id: bankId, restaurant_id: restaurantId, bank_name: "TEST BANK", account_no: "001234", account_name: "TEST ONLY", is_default: false },
      { id: other, restaurant_id: other, bank_name: "OTHER", account_no: "0099", account_name: "OTHER", is_default: true }],
    registrations: [],
  };
  if (options.otherDefault) state.banks.push({ ...state.banks[0], id: "55555555-5555-4555-8555-555555555555", account_no: "00555", is_default: true });
  if (options.targetDefault) state.banks[0].is_default = true;
  if (options.notOwner) state.restaurant.owner_id = other;
  const client = {
    auth: { async getUser() {
      calls.push({ kind: "auth" });
      return { data: { user: options.noUser ? null : { id: options.authUserId ?? userId } }, error: options.authError ? { message: "PRIVATE_AUTH" } : null };
    } },
    async rpc(name, payload) {
      if (name === "set_restaurant_operating_status") {
        // Model only the supplied RPC contract; not a PostgreSQL/permission test.
        calls.push({ kind: "rpc", name, payload });
        if (options.rpcNetworkError) throw Error("PRIVATE_NETWORK");
        if (options.rpcError) return { data: null, error: options.rpcError };
        options.beforeOpenRpc?.(state);
        if (state.restaurant.owner_id !== (options.authUserId ?? userId)) return { data: null, error: { code: "P0001", message: "NOT_ALLOWED" } };
        state.restaurant.operating_status = payload.p_operating_status;
        state.restaurant.updated_at = new Date().toISOString();
        if (options.commitThenNetworkError) throw Error("PRIVATE_AFTER_COMMIT");
        return { data: options.rpcResponse === undefined ? { success: true, operating_status: "open", unexpected: "PRIVATE" } : options.rpcResponse, error: null };
      }
      assert.equal(name, "register_seller");
      // Model the provided RPC contract/serialized outcome, not PostgreSQL itself.
      // Record only non-secret args and a boolean assertion about the synthetic PIN.
      const { p_app_lock_pin: pin, ...safePayload } = payload;
      calls.push({ kind: "rpc", name, payload: safePayload, pinPreserved: pin === testPin() });
      let unlock;
      const before = rpcTail; rpcTail = new Promise((done) => { unlock = done; }); await before;
      try {
        if (options.rpcNetworkError) throw new Error("PRIVATE_NETWORK");
        if (options.rpcError) return { data: null, error: options.rpcError };
        if (currentRole !== "student") return { data: null, error: { code: "P0001", message: "ALREADY_SELLER" } };
        currentRole = "seller";
        const restaurant = { id: restaurantId, owner_id: userId, name: payload.p_restaurant_name, slug: "rpc-generated-slug", operating_status: "closed", operating_hours: payload.p_operating_hours };
        state.registrations.push(restaurant);
        if (options.commitThenNetworkError) throw new Error("PRIVATE_NETWORK_AFTER_COMMIT");
        return { data: options.rpcResponse ?? { success: true, user: { id: userId, role: "seller", app_lock_pin: "PRIVATE" }, restaurant: { ...restaurant, delivery_token: "PRIVATE" } }, error: null };
      } finally { unlock(); }
    },
    from(table) {
      const call = { table, mode: "select", filters: [], columns: "", values: null }; calls.push(call);
      const query = {
        select(columns) { call.columns = columns; return this; },
        eq(field, value) { call.filters.push([field, value, "eq"]); return this; },
        neq(field, value) { call.filters.push([field, value, "neq"]); return this; },
        limit() { return this; },
        order(column) { call.order = column; return this; },
        range(from, to) { call.range = [from, to]; return this; },
        async then(resolve, reject) {
          try {
            if (options.throwAt === "list") throw Error("PRIVATE_LIST");
            if (options.errorAt === "list") return resolve({ data: null, error: options.error ?? { code: "42501", message: "PRIVATE" } });
            const rows = state.banks.filter(row => call.filters.every(([key, value]) => row[key] === value))
              .sort((a, b) => a.id.localeCompare(b.id));
            const [from, to] = call.range;
            return resolve({ data: rows.slice(from, Math.min(to + 1, from + (options.readPageSize ?? 100))), error: null });
          } catch (error) { return reject(error); }
        },
        update(value) { call.mode = "update"; call.values = value; return this; },
        insert(value) { call.mode = "insert"; call.values = value; return this; },
        async maybeSingle() {
          const stage = table === "users" ? "profile" : call.mode !== "select" ? "write" : table === "restaurants" ? "owner" : call.filters.some(([key]) => key === "is_default") ? "default" : "bank";
          if (options.throwAt === stage) throw new Error("PRIVATE_THROW");
          if (options.errorAt === stage) return { data: null, error: options.error ?? { code: "42501", message: "PRIVATE_DB", details: "PRIVATE" } };
          if (stage === "profile") return { data: options.noProfile ? null : { role: currentRole, status: options.status ?? "active" }, error: null };
          if (options.hiddenUpdate && stage === "write") return { data: null, error: null };
          const matches = (row) => call.filters.every(([key, value, op]) => op === "eq" ? row[key] === value : row[key] !== value);
          const rows = table === "restaurants" ? (options.noRestaurant ? [] : [state.restaurant]) : state.banks;
          let row = rows.find(matches);
          if (call.mode === "insert") row = call.values;
          if (call.mode !== "select") {
            if (!row) return { data: null, error: null };
            const values = { ...row, ...call.values };
            if (table === "restaurant_banks") {
              for (const [constraint, conflict] of [
                ["uq_restaurant_banks_account", state.banks.some((b) => b.id !== values.id && b.restaurant_id === values.restaurant_id && b.account_no === values.account_no)],
                ["uq_restaurant_banks_one_default", values.is_default && state.banks.some((b) => b.id !== values.id && b.restaurant_id === values.restaurant_id && b.is_default)],
              ]) if (conflict) return { data: null, error: { code: "23505", message: `duplicate key violates unique constraint "${constraint}"` } };
            }
            if (call.mode === "insert") { row = { ...values }; state.banks.push(row); }
            else Object.assign(row, call.values);
          }
          return { data: row ? { ...row, delivery_token: "PRIVATE", unexpected: "PRIVATE" } : null, error: null };
        },
      };
      return query;
    },
  };
  const service = load("../services/seller.service.ts", { "@/lib/supabase/server": { createClient: async () => client } });
  return { ...service, client, calls, state, profileRole: () => currentRole,
    rpcCalls: () => calls.filter((c) => c.kind === "rpc"),
    writes: () => calls.filter((c) => c.mode === "insert" || c.mode === "update"),
    api(mode) {
      const mocks = { "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
        "@/lib/supabase/server": { createClient: async () => client }, "@/services/seller.service": service };
      const route = load(mode === "register" ? "../app/api/seller/register/route.ts" : mode === "restaurant" ? "../app/api/seller/restaurants/[restaurantId]/route.ts" : "../app/api/seller/restaurants/[restaurantId]/banks/_handler.ts", mocks);
      return async (input, config = {}) => {
        const request = new Request("http://localhost:3000/api/test", { method: mode === "read" ? "GET" : "POST", headers: { origin: config.origin ?? "http://localhost:3000", "Content-Type": "application/json" }, ...(mode === "read" ? {} : {body: config.raw ?? JSON.stringify(input)}) });
        const params = Promise.resolve({ restaurantId: config.restaurantId ?? restaurantId, bankId: config.bankId ?? bankId });
        return mode === "register" ? route.POST(request) : mode === "restaurant" ? route.PATCH(request, { params }) : route.handleBankRequest(request, params, mode);
      };
    },
  };
}
export function assertSafe(value) { assert.ok(!JSON.stringify(value).includes("PRIVATE")); }
export const registration = (patch = {}) => ({ name: " Quán ", description: " Mô tả ", location: " KTX ", cash: true, bank: false, appLockPin: testPin(), scheduleMode: "later", ...patch });
