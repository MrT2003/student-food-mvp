import assert from "node:assert/strict";
import { test } from "node:test";
import { load, userId, restaurantId, other } from "./seller-sdk-fixture.mjs";

function setup(role = "staff", options = {}) {
  let row = { id: userId, role, status: "active", work_for_restaurant_id: role === "staff" ? restaurantId : null };
  let requests = 0, rpcCalls = 0, orderReads = 0, events = 0, profileReads = 0;
  let stored = { ...row };
  const client = {
    auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id: userId } } }) },
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        async range() {
          assert.equal(table, "orders");
          orderReads++;
          return { data: [], error: null };
        },
        async maybeSingle() {
          assert.ok(["users", "restaurants"].includes(table));
          if (table === "users" && options.readFails) return { data: null, error: { message: "PRIVATE_READ" } };
          return { data: table === "users" ? row : { id: restaurantId }, error: null };
        },
      };
    },
    async rpc(name, args) {
      rpcCalls++;
      assert.equal(name, "leave_staff_restaurant");
      assert.deepEqual(Object.keys(args), ["p_restaurant_id"]);
      if (options.rpcError) return { error: options.rpcError };
      // Model the conditional UPDATE at the RPC boundary.
      if (row.role !== "staff" || row.work_for_restaurant_id !== args.p_restaurant_id)
        return { error: { code: "P0001", message: "STAFF_LEAVE_CONFLICT" } };
      row = { ...row, role: "student", work_for_restaurant_id: null };
      return { data: row };
    },
  };
  const service = load("../services/seller.service.ts");
  const handler = load("../lib/seller/staff-http.ts", {
    "@/services/seller.service": service, "@/lib/supabase/server": { createClient: async () => client },
    "next/server": { NextResponse: { json: Response.json } },
  });
  const { POST, GET } = load("../app/api/staff/leave/route.ts", {
    "@/services/seller.service": service, "@/lib/seller/staff-http": handler,
    "@/lib/supabase/server": { createClient: async () => client },
    "next/server": { NextResponse: { json: Response.json } },
  });
  const request = (body, origin = "http://localhost:3000") => POST(new Request("http://localhost:3000/api/staff/leave", {
    method: "POST", headers: { Origin: origin }, body: JSON.stringify(body),
  }));
  const app = load("../lib/seller/staff-client.ts", {
    "@/services/auth.service": { getCurrentProfile: async () => assert.fail("Leave must read current membership from the server") },
    "@/store/useAuthStore": { useAuthStore: { getState: () => ({ user: stored, setUser: profile => { stored = profile; } }) } },
  }, {
    window: { dispatchEvent() { events++; } }, Event,
    async fetch(path, input) {
      assert.equal(path, "/api/staff/leave");
      assert.equal(input.cache, "no-store");
      assert.equal(input.credentials, "same-origin");
      if (input.method === "GET") {
        profileReads++;
        const response = await GET();
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        return response;
      }
      assert.equal(input.method, "POST");
      requests++;
      const response = await request(JSON.parse(input.body));
      if (options.network) throw Error("Connection lost");
      return response;
    },
  });
  return { request, read: GET, app, client, getRow: () => row, stored: () => stored, counts: () => ({ requests, rpcCalls, orderReads, events, profileReads }),
    switchShop: () => { row = { ...row, role: "staff", work_for_restaurant_id: other }; } };
}

test("session leaves A, loses staff order access, and replay for A cannot clear B", async () => {
  const f = setup();
  const { SellerOrderServices } = load("../services/seller-orders.service.ts", {
    "@/lib/seller/order-contract": load("../lib/seller/order-contract.ts"),
  });
  await SellerOrderServices.list(f.client, userId, restaurantId);
  await f.app.leaveStaffRestaurant(userId, restaurantId);
  assert.equal(f.getRow().role, "student");
  assert.equal(f.stored().work_for_restaurant_id, null);
  assert.equal(f.counts().events, 1);
  await assert.rejects(SellerOrderServices.list(f.client, userId, restaurantId));
  assert.equal(f.counts().orderReads, 1);
  assert.equal((await f.request({ restaurantId })).status, 409);
  f.switchShop();
  assert.equal((await f.request({ restaurantId })).status, 409);
  assert.equal(f.getRow().work_for_restaurant_id, other);
});

test("leave rejects anonymous, other roles, cross-origin and client identity", async () => {
  for (const role of ["student", "seller"]) {
    const f = setup(role);
    assert.equal((await f.request({ restaurantId })).status, 409);
    assert.equal(f.getRow().role, role);
  }
  const anon = setup("staff", { anonymous: true });
  assert.equal((await anon.request({ restaurantId })).status, 401);
  const f = setup();
  assert.equal((await f.request({ restaurantId }, "https://other.invalid")).status, 403);
  assert.equal((await f.request({ restaurantId, user_id: other })).status, 400);
  assert.equal(f.counts().rpcCalls, 0);
});

test("lost response uses authoritative profile without replay and does not fake success if read fails", async () => {
  for (const readFails of [false, true]) {
    const f = setup("staff", { network: true, readFails });
    const result = f.app.leaveStaffRestaurant(userId, restaurantId);
    if (readFails) await assert.rejects(result, /Chưa xác nhận/);
    else await result;
    assert.equal(f.counts().requests, 1);
    assert.equal(f.counts().profileReads, 1);
    assert.equal(f.stored().role, readFails ? "staff" : "student");
  }
});


test("explicit DB rejection stays distinct from missing RPC or an unknown write", async () => {
  for (const [rpcError, status, code, expected] of [
    [{ code: "23514", message: "PRIVATE_CONSTRAINT" }, 422, "STAFF_LEAVE_REJECTED", /Database từ chối/],
    [{ code: "P0001", message: "PRIVATE_TRIGGER" }, 422, "STAFF_LEAVE_REJECTED", /Database từ chối/],
    [{ code: "PGRST202", message: "PRIVATE_FUNCTION" }, 503, "STAFF_LEAVE_RPC_UNAVAILABLE", /RPC rời cửa hàng/],
    [{ code: "PGRST203", message: "PRIVATE_OVERLOAD" }, 503, "STAFF_LEAVE_RPC_UNAVAILABLE", /RPC rời cửa hàng/],
    [{ code: "42501", message: "PRIVATE_PERMISSION" }, 403, "DATABASE_ACCESS_DENIED", /quyền database/],
  ]) {
    const f = setup("staff", { rpcError, readFails: true });
    const response = await f.request({ restaurantId });
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
    await assert.rejects(f.app.leaveStaffRestaurant(userId, restaurantId), error =>
      expected.test(error.message) && !error.message.includes("PRIVATE"));
    assert.equal(f.getRow().role, "staff");
    assert.equal(f.counts().profileReads, 0);
  }
});

test("failed readback cannot mask an explicit assignment conflict", async () => {
  const f = setup("staff", { readFails: true });
  f.switchShop();
  await assert.rejects(f.app.leaveStaffRestaurant(userId, restaurantId), /Quan hệ nhân viên đã thay đổi/);
  assert.equal(f.getRow().work_for_restaurant_id, other);
  assert.equal(f.counts().requests, 1);
});


test("a confirmed write and an unavailable profile are reported separately", async () => {
  const f = setup("staff", { readFails: true });
  await assert.rejects(f.app.leaveStaffRestaurant(userId, restaurantId), /Backend đã xác nhận.*chưa tải/);
  assert.equal(f.getRow().role, "student");
  assert.equal(f.stored().role, "staff");
  assert.equal(f.counts().requests, 1);
  assert.equal(f.counts().profileReads, 1);
});

test("readback accepts the signed-in student without staff access or private profile fields", async () => {
  const f = setup("student");
  f.getRow().privateField = "PRIVATE";
  const response = await f.read();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { profile: { id: userId, role: "student", status: "active", work_for_restaurant_id: null } });
  assert.equal((await setup("staff", { anonymous: true }).read()).status, 401);
});
