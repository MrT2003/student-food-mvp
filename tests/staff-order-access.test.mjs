import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, mocks = {}) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, URL, console: { error() { throw new Error("Must not log raw database errors"); } }, require(id) {
    if (id === "server-only") return {};
    if (id === "@/lib/http/request-origin") return load("../lib/http/request-origin.ts");
    if (id in mocks) return mocks[id];
    if (id === "@/utilities/system.utility") return load("../utilities/system.utility.ts");
    throw new Error(`Unexpected import: ${id}`);
  } });
  return exports;
}
const userId = "11111111-1111-4111-8111-111111111111";
const restaurantId = "22222222-2222-4222-8222-222222222222";
const orderId = "33333333-3333-4333-8333-333333333333";
const other = "44444444-4444-4444-8444-444444444444";
function fixture(options = {}) {
  const calls = [];
  let status = options.orderStatus ?? "pending";
  let writes = 0;
  const client = {
    auth: { async getUser() { return { data: { user: options.noUser ? null : { id: userId } }, error: options.authError ? new Error("SECRET_AUTH") : null }; } },
    from(table) {
      const call = { table, filters: [], selection: null, update: null }; calls.push(call);
      return {
        select(fields) { call.selection = fields; return this; },
        eq(field, value) { call.filters.push([field, value]); return this; },
        update(value) { call.update = value; return this; },
        async maybeSingle() {
          if (options.queryError) return { data: null, error: { code: "SECRET_CODE", message: "SECRET_DB" } };
          if (table === "users") return { data: options.missingProfile ? null : {
            role: options.role ?? "staff", status: options.status ?? "active", work_for_restaurant_id: "work" in options ? options.work : restaurantId,
          }, error: null };
          if (table === "restaurants") return { data: options.notOwner ? null : { id: restaurantId }, error: null };
          if (table === "orders") {
            if (call.update) {
              if (options.policyError) return { data: null, error: { code: "42501", message: "SECRET_POLICY" } };
              if (options.hiddenUpdate || status !== "pending") return { data: null, error: null };
              writes++; status = "accepted";
              return { data: { id: orderId, restaurant_id: restaurantId, order_status: status, accepted_at: call.update.accepted_at, token: "SECRET_TOKEN" }, error: null };
            }
            const staffFilter = call.filters.find(([field]) => field === "restaurant_id");
            if (options.missingOrder || (staffFilter && staffFilter[1] !== restaurantId)) return { data: null, error: null };
            return { data: { id: orderId, restaurant_id: restaurantId, order_status: status }, error: null };
          }
          return { data: null, error: null };
        },
      };
    },
    async rpc(name, payload) {
      calls.push({ rpc: name, payload });
      if (options.rpcError) return { data: null, error: { message: options.rpcError } };
      if (options.rpcBlocked) return { data: null, error: { message: "ACCOUNT_NOT_ALLOWED" } };
      return { data: { orders: [], sessionCheckoutId: "test-session" }, error: null };
    },
  };
  const approval = load("../services/order-approval.service.ts");
  const purchase = load("../lib/auth/purchase-access.ts");
  return { ...approval, ...purchase, client, calls, writes: () => writes };
}
for (const role of ["student", "staff"]) {
  test(`${role} can purchase as self at application guard`, async () => {
    const f = fixture({ role }); assert.equal(await f.assertPurchaseAccess(f.client, userId), userId);
    assert.deepEqual(f.calls[0].filters, [["id", userId]]);
  });
  test(`${role} createOrder keeps existing RPC/price payload`, async () => {
    const f = fixture({ role });
    const { OrderServices } = load("../services/order.service.ts", { "@/lib/supabase/client": { createClient: () => f.client }, "@/lib/auth/purchase-access": f });
    await OrderServices.createOrder({ items: [{ cartItemId: orderId, quantity: 1, expectedUnitPrice: 10000 }], deliveryAddress: "KTX A", paymentMethod: "cash", expectedTotal: 10000 });
    const rpc = f.calls.find((call) => call.rpc);
    assert.equal(rpc.rpc, "create_checkout_orders"); assert.equal(rpc.payload.p_expected_total, 10000);
    assert.equal(rpc.payload.p_checkout_items[0].cart_item_id, orderId);
  });
}
test("staff still blocked by existing RPC is not rerouted to elevated DB/new checkout", async () => {
  const f = fixture({ rpcBlocked: true });
  const { OrderServices } = load("../services/order.service.ts", { "@/lib/supabase/client": { createClient: () => f.client }, "@/lib/auth/purchase-access": f });
  await assert.rejects(OrderServices.createOrder({ items: [{ cartItemId: orderId, quantity: 1, expectedUnitPrice: 1 }], deliveryAddress: "A", paymentMethod: "cash", expectedTotal: 1 }), /ACCOUNT_NOT_ALLOWED/);
  assert.equal(f.calls.filter((call) => call.rpc).length, 1);
});

test("checkout sanitizes unknown RPC errors and preserves known business messages", async () => {
  for (const [message, expected] of [["PRIVATE_DATABASE_DETAIL", "Tạo đơn hàng thất bại."],
    ["PRICE_MISMATCH: PRIVATE_DATABASE_DETAIL", "PRICE_MISMATCH"],
    ["SOME_ITEMS_NOT_FOUND_OR_INVALID_OWNER", "Sản phẩm trong giỏ hàng"],
    ["INVALID_QUANTITY_TO_BUY", "Số lượng đặt mua"], ["UNAUTHORIZED", "Phiên đăng nhập"]]) {
    const f = fixture({ rpcError: message });
    const { OrderServices } = load("../services/order.service.ts", { "@/lib/supabase/client": { createClient: () => f.client }, "@/lib/auth/purchase-access": f });
    await assert.rejects(OrderServices.createOrder({ items: [{ cartItemId: orderId, quantity: 1, expectedUnitPrice: 1 }], deliveryAddress: "A", paymentMethod: "cash", expectedTotal: 1 }),
      (error) => error.message.includes(expected) && !error.message.includes("PRIVATE_DATABASE_DETAIL"));
    assert.equal(f.calls.filter((call) => call.rpc).length, 1);
  }
});

test("cart read and every mutation sanitize DB errors without logging", async () => {
  const f = fixture({ rpcError: "PRIVATE_DATABASE_DETAIL", queryError: true });
  const { CartServices } = load("../services/cart.service.ts", {
    "@/lib/supabase/client": { createClient: () => f.client },
    "@/lib/auth/purchase-access": { assertPurchaseAccess: async () => userId },
    "@/utilities/cart_order.utility": { CartUtilities: { formatSortSelectedOptions: (items) => items } },
    "@/lib/cart/calculations": { getCartSummary: () => ({}) },
  });
  for (const [action, message] of [[() => CartServices.getCart(userId), "Không thể tải giỏ hàng. Vui lòng thử lại."],
    [() => CartServices.addToCart({ menuItemId: orderId, restaurantId, quantity: 1, selectedOptions: [] }), "Cannot add product to cart."],
    [() => CartServices.updateQuantity(orderId, 2), "Không thể cập nhật số lượng trong giỏ hàng."],
    [() => CartServices.updateOptions(orderId, "NONE", [], 1), "Không thể cập nhật tùy chọn trong giỏ hàng."],
    [() => CartServices.deleteCartItem(orderId), "Không thể xóa món khỏi giỏ hàng."]]) {
    await assert.rejects(action(), { message });
  }
});
for (const options of [{ role: "seller" }, { status: "inactive" }, { noUser: true }, { missingProfile: true }, { authError: true }]) {
  test(`purchase rejects disallowed self ${JSON.stringify(options)}`, async () => {
    const f = fixture(options); await assert.rejects(f.assertPurchaseAccess(f.client, userId));
  });
}
test("purchase guard denies another user id", async () => {
  const f = fixture(); await assert.rejects(f.assertPurchaseAccess(f.client, other)); assert.equal(f.calls.length, 0);
});
test("all cart mutation methods allow staff guard and preserve existing RPC ownership enforcement", async () => {
  const f = fixture();
  const { CartServices } = load("../services/cart.service.ts", {
    "@/lib/supabase/client": { createClient: () => f.client }, "@/lib/auth/purchase-access": f,
    "@/utilities/cart_order.utility": { CartUtilities: { formatSortSelectedOptions: (items) => items } },
    "@/lib/cart/calculations": { getCartSummary: () => ({}) },
  });
  await CartServices.addToCart({ menuItemId: orderId, restaurantId, quantity: 1, optionHash: "NONE", selectedOptions: [] });
  await CartServices.updateQuantity(orderId, 2);
  await CartServices.updateOptions(orderId, "NONE", [], 1);
  await CartServices.deleteCartItem(orderId);
  assert.deepEqual(f.calls.filter((call) => call.rpc).map((call) => call.rpc), ["add_to_cart", "update_cart_item_quantity", "update_cart_item_options", "delete_cart_item"]);
  await assert.rejects(CartServices.getCart(other));
});

for (const role of ["seller", "staff"]) {
  test(`${role} accepts only pending order for authorized restaurant`, async () => {
    const f = fixture({ role });
    const result = await f.OrderApprovalServices.acceptOrder(f.client, userId, orderId, {});
    assert.equal(result.order.order_status, "accepted");
    assert.deepEqual(Object.keys(result.order).sort(), ["accepted_at", "id", "order_status", "restaurant_id"]);
    const update = f.calls.find((c) => c.update);
    assert.deepEqual(Object.keys(update.update).sort(), ["accepted_at", "order_status"]);
    assert.deepEqual(update.filters, [["id", orderId], ["restaurant_id", restaurantId], ["order_status", "pending"]]);
    if (role === "seller") assert.deepEqual(f.calls.find((c) => c.table === "restaurants").filters, [["id", restaurantId], ["owner_id", userId]]);
    if (role === "staff") assert.deepEqual(f.calls.find((c) => c.table === "orders" && !c.update).filters, [["id", orderId], ["restaurant_id", restaurantId]]);
    assert.ok(!JSON.stringify(result).includes("SECRET"));
  });
}
for (const [options, code] of [
  [{ role: "student" }, "ORDER_FORBIDDEN"], [{ status: "inactive" }, "ORDER_FORBIDDEN"],
  [{ missingProfile: true }, "ORDER_FORBIDDEN"], [{ work: null }, "ORDER_FORBIDDEN"],
  [{ work: other }, "ORDER_NOT_FOUND"], [{ role: "seller", notOwner: true }, "ORDER_NOT_FOUND"],
  [{ missingOrder: true }, "ORDER_NOT_FOUND"], [{ orderStatus: "accepted" }, "ORDER_CONFLICT"],
  [{ orderStatus: "completed" }, "ORDER_CONFLICT"], [{ orderStatus: "cancelled" }, "ORDER_CONFLICT"],
  [{ orderStatus: "rejected" }, "ORDER_CONFLICT"], [{ policyError: true }, "ORDER_FORBIDDEN"],
  [{ hiddenUpdate: true }, "ORDER_CONFLICT"], [{ queryError: true }, "ORDER_APPROVAL_FAILED"],
]) {
  test(`approval rejects ${JSON.stringify(options)}`, async () => {
    const f = fixture(options); await assert.rejects(f.OrderApprovalServices.acceptOrder(f.client, userId, orderId, {}), { message: code });
    assert.equal(f.writes(), 0);
  });
}
for (const input of [null, [], { order_status: "completed" }, { restaurantId }, { role: "seller" }]) {
  test(`approval rejects client-directed state/ownership ${JSON.stringify(input)}`, async () => {
    const f = fixture(); await assert.rejects(f.OrderApprovalServices.acceptOrder(f.client, userId, orderId, input), /VALIDATION_ERROR/);
    assert.equal(f.calls.length, 0);
  });
}
test("approval invalid UUID and two concurrent accepts/repeat only update once (mock)", async () => {
  const f = fixture(); await assert.rejects(f.OrderApprovalServices.acceptOrder(f.client, userId, "bad", {}), /VALIDATION_ERROR/);
  const results = await Promise.allSettled([f.OrderApprovalServices.acceptOrder(f.client, userId, orderId, {}), f.OrderApprovalServices.acceptOrder(f.client, userId, orderId, {})]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1); assert.equal(f.writes(), 1);
  await assert.rejects(f.OrderApprovalServices.acceptOrder(f.client, userId, orderId, {}), /ORDER_CONFLICT/);
});
function apiFixture(options = {}) {
  const f = fixture(options);
  const route = load("../app/api/orders/[orderId]/accept/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/supabase/server": { createClient: async () => f.client }, "@/services/order-approval.service": f,
  });
  return { ...f, route,
    request(body = "{}") { return new Request("https://example.com/api/orders/test/accept", { method: "POST", headers: { origin: "https://example.com" }, body }); },
    call(request) { return route.POST(request, { params: Promise.resolve({ orderId }) }); },
  };
}
for (const [options, expected] of [[{}, 200], [{ noUser: true }, 401], [{ role: "student" }, 403], [{ work: other }, 404], [{ hiddenUpdate: true }, 409], [{ queryError: true }, 500]]) {
  test(`approval API verifies session/RLS errors ${JSON.stringify(options)}`, async () => {
    const f = apiFixture(options); const response = await f.call(f.request());
    assert.equal(response.status, expected); assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.ok(!(await response.text()).includes("SECRET"));
  });
}
test("approval API blocks Origin/malformed JSON before mutation", async () => {
  const f = apiFixture(); const request = f.request(); request.headers.set("origin", "https://evil.invalid");
  assert.equal((await f.call(request)).status, 403);
  assert.equal((await f.call(f.request("bad json"))).status, 400); assert.equal(f.writes(), 0);
});
