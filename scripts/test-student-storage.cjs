/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated Node runner: transpile repository TS and resolve @/ without extra dependencies.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args);
};
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  module._compile(outputText, filename);
};

const { useStudentMockStore: store, startStudentPersistence: start } = require("../store/useStudentMockStore.ts");
const { studentStorageKey } = require("../lib/mocks/student-storage.ts");
const { mockMenuItemDetails: menu } = require("../lib/mocks/catalog.mock.ts");
const { projectCart } = require("../lib/cart/view-model.ts");
const { getCheckoutView } = require("../lib/orders/checkout-view.ts");
const checkoutView = (s) => getCheckoutView(s.orderRecords, s.cart.student_id, s.lastCheckout);
const initial = store.getState();
const reset = () => store.setState(initial, true);
const key = studentStorageKey(initial.cart.student_id);
const memory = () => {
  const data = new Map();
  return { data, writes: 0, getItem: (k) => data.get(k) ?? null,
    setItem(k, v) { this.writes++; data.set(k, v); } };
};
const simple = menu.find((item) => item.option_groups.length === 0);
const drink = menu.find((item) => item.option_groups.length > 0);
function add(item = simple, selected = []) {
  assert.equal(store.getState().addCatalogItem({
    menu_item_id: item.id, restaurant_id: item.restaurant_id,
    quantity: 1, selected_options: selected,
  }).ok, true);
}
let passed = 0;
function test(name, fn) {
  reset();
  fn();
  passed++;
  console.log(`PASS ${name}`);
}

test("Restore cart, options, quantity, address and per-restaurant preferences", () => {
  const storage = memory();
  let stop = start(storage);
  assert.equal(storage.writes, 0, "hydration must not overwrite storage");
  const selected = drink.option_groups.map((group) => ({ option_id: group.options[0].id }));
  add(simple); add(drink, selected); add(drink, selected);
  store.getState().setLocation("KTX B");
  store.getState().setAddress("Phòng 302");
  store.getState().setPreference(simple.restaurant_id, { payment: "bank", note: "Ít cay" });
  store.getState().setPreference(drink.restaurant_id, { payment: "cash", note: "Ít ngọt" });
  const before = store.getState();
  const saved = JSON.parse(storage.getItem(key));
  assert.equal(saved.items, undefined);
  assert.equal(saved.ordersById, undefined);
  assert.equal(saved.hasHydrated, undefined);
  stop(); reset(); stop = start(storage);
  const after = store.getState();
  assert.equal(after.hasHydrated, true);
  assert.equal(after.storageWarning, null);
  for (const field of ["cart_items", "location", "address", "preferences"]) {
    assert.deepEqual(after[field], before[field]);
  }
  assert.deepEqual(projectCart(after.cart_items), projectCart(before.cart_items));
  for (const obsolete of ["items", "restaurants", "ordersById", "orderIds", "checkout", "lastCheckoutResult", "setItems"]) {
    assert.equal(obsolete in after, false);
  }
  stop();
});

test("Checkout is one write; F5 preserves all sessions, snapshots and success page", () => {
  const storage = memory();
  let stop = start(storage);
  add();
  store.getState().setAddress("Phòng 101");
  assert.equal(store.getState().checkoutCart().ok, true);
  const oldOrder = Object.values(store.getState().orderRecords)[0];
  add();
  add(menu.find((item) => item.restaurant_id !== simple.restaurant_id && !item.option_groups.length));
  const writes = storage.writes;
  assert.equal(store.getState().checkoutCart().ok, true);
  assert.equal(storage.writes, writes + 1);
  const before = store.getState();
  assert.equal(Object.keys(before.orderRecords).length, 3);
  stop(); reset(); stop = start(storage);
  const after = store.getState();
  assert.deepEqual(after.orderRecords, before.orderRecords);
  assert.deepEqual(after.orderRecords[oldOrder.id], oldOrder);
  assert.deepEqual(after.cart_items, []);
  const restored = checkoutView(after);
  const original = checkoutView(before);
  assert.equal(restored.orders.length, 2);
  assert.deepEqual(new Set(restored.orders.map((o) => o.id)), new Set(original.orders.map((o) => o.id)));
  assert.equal(restored.address, "Phòng 101");
  assert.equal(restored.orders.reduce((sum, order) => sum + order.total, 0),
    original.orders.reduce((sum, order) => sum + order.total, 0));
  stop();
});

test("StrictMode remount does not duplicate subscriptions or overwrite stored data", () => {
  const storage = memory();
  let stop = start(storage); stop(); stop = start(storage);
  add();
  assert.equal(storage.writes, 1);
  stop();
});

test("Invalid JSON, wrong version/account and invalid quantities never overwrite backup", () => {
  const storage = memory();
  let stop = start(storage); add(); stop();
  const valid = JSON.parse(storage.getItem(key));
  for (const raw of ["{broken", JSON.stringify({ ...valid, version: 99 }),
    JSON.stringify({ ...valid, customerId: "another-account" }),
    JSON.stringify({ ...valid, cart_items: [{ ...valid.cart_items[0], quantity: -1 }] })]) {
    reset(); storage.data.set(key, raw);
    stop = start(storage);
    assert.equal(store.getState().hasHydrated, true);
    assert.ok(store.getState().storageWarning);
    assert.equal(store.getState().cart_items.length, 0);
    stop(); stop = start(storage); // StrictMode must retain read-failure protection.
    add();
    assert.equal(storage.getItem(key), raw);
    stop();
  }
});

test("Storage read blocked still allows in-memory demo without hanging", () => {
  let writes = 0;
  const stop = start({ getItem() { throw Error("blocked"); }, setItem() { writes++; } });
  assert.equal(store.getState().hasHydrated, true);
  add();
  assert.ok(store.getState().storageWarning);
  assert.equal(writes, 0);
  stop();
});

test("Quota failure warns, preserves old save, and retries on next data change", () => {
  const storage = memory();
  let blocked = false;
  const stop = start({ getItem: storage.getItem, setItem(k, value) {
    if (blocked) throw Error("quota");
    storage.setItem(k, value);
  } });
  add();
  const saved = storage.getItem(key);
  blocked = true;
  add();
  assert.equal(store.getState().cart_items[0].quantity, 2);
  assert.ok(store.getState().storageWarning);
  assert.equal(storage.getItem(key), saved);
  blocked = false;
  add();
  assert.equal(store.getState().storageWarning, null);
  assert.equal(JSON.parse(storage.getItem(key)).cart_items[0].quantity, 3);
  stop();
});

function endLatestOrder() {
  store.getState().setAddress("Phòng 302");
  assert.equal(store.getState().checkoutCart().ok, true);
  const id = Object.values(store.getState().orderRecords).find((o) => o.session_checkout_id === store.getState().lastCheckout.sessionId).id;
  const order = { ...store.getState().orderRecords[id], order_status: "completed" };
  store.setState({ orderRecords: { ...store.getState().orderRecords, [id]: order } });
  return order;
}

test("Reorder merges quantities, preserves other shops/preferences and survives reload", () => {
  const storage = memory();
  let stop = start(storage);
  add(); add();
  const order = endLatestOrder();
  add();
  const other = menu.find((m) => m.restaurant_id !== simple.restaurant_id && !m.option_groups.length);
  add(other);
  store.getState().setPreference(simple.restaurant_id, { payment: "bank", note: "Ghi chú mới" });
  const before = store.getState();
  const writes = storage.writes;
  assert.equal(before.reorderOrder(order.id).ok, true);
  assert.equal(storage.writes, writes + 1);
  const after = store.getState();
  assert.equal(after.cart_items.find((r) => r.menu_item_id === simple.id).quantity, 3);
  assert.equal(after.cart_items.find((r) => r.menu_item_id === other.id).quantity, 1);
  assert.deepEqual(after.preferences, before.preferences);
  assert.deepEqual(after.orderRecords, before.orderRecords);
  stop(); reset(); stop = start(storage);
  assert.deepEqual(store.getState().cart_items, after.cart_items);
  stop();
});

test("Reorder rejects missing, another customer's and ongoing orders", () => {
  const stop = start(memory());
  add();
  const order = endLatestOrder();
  assert.equal(store.getState().reorderOrder("missing").ok, false);
  for (const changed of [
    { ...order, student_id: "another-customer" },
    { ...order, order_status: "pending" },
    { ...order, order_status: "accepted" },
  ]) {
    store.setState({ orderRecords: { [order.id]: changed } });
    assert.equal(store.getState().reorderOrder(order.id).ok, false);
    assert.equal(store.getState().cart_items.length, 0);
  }
  stop();
});

test("Reorder uses current base/addon prices and keeps option variants separate", () => {
  const stop = start(memory());
  const selected = drink.option_groups.map((g) => ({ option_id: g.options[0].id }));
  add(drink, selected);
  const order = endLatestOrder();
  const variant = selected.slice(1); // omit optional topping, retain required sugar/ice
  add(drink, variant);
  const originalPrice = drink.price;
  const option = drink.option_groups[0].options[0];
  const originalAddon = option.additional_price;
  try {
    drink.price += 1000;
    option.additional_price += 2000;
    assert.equal(store.getState().reorderOrder(order.id).ok, true);
    assert.equal(store.getState().cart_items.length, 2);
    const restored = projectCart(store.getState().cart_items).items.find((i) => i.extras.some((e) => e.id === option.id));
    assert.equal(restored.basePrice, originalPrice + 1000);
    assert.equal(restored.extras.find((e) => e.id === option.id).price, originalAddon + 2000);
    assert.deepEqual(store.getState().orderRecords[order.id], order);
  } finally { drink.price = originalPrice; option.additional_price = originalAddon; stop(); }
});

test("Reorder failures are atomic: missing menu, removed options, closed shop, limit", () => {
  const { prepareReorder } = require("../lib/orders/reorder.ts");
  const { mockRestaurants } = require("../lib/mocks/catalog.mock.ts");
  const stop = start(memory());
  add();
  const second = menu.find((m) => m.id !== simple.id && m.restaurant_id === simple.restaurant_id && !m.option_groups.length);
  add(second);
  const order = endLatestOrder();
  add();
  const context = { customerId: initial.cart.student_id, cartId: initial.cart.id,
    rows: store.getState().cart_items, menu: structuredClone(menu), restaurants: structuredClone(mockRestaurants) };
  const before = JSON.stringify(context.rows);
  const missing = { ...context, menu: context.menu.filter((m) => m.id !== second.id) };
  assert.throws(() => prepareReorder(order, missing), /không còn khả dụng/);
  const closed = structuredClone(context);
  closed.restaurants.find((r) => r.id === order.restaurant_id).operating_status = "closed";
  assert.throws(() => prepareReorder(order, closed), /không nhận đơn/);
  const deletedOption = structuredClone(order);
  deletedOption.order_items[1].option_snapshot_price = [{ option_id: "missing-option" }];
  assert.throws(() => prepareReorder(deletedOption, context), /tùy chọn/);
  const overflow = structuredClone(order);
  overflow.order_items[1].quantity = 100;
  assert.throws(() => prepareReorder(overflow, context), /99/);
  assert.equal(JSON.stringify(context.rows), before);
  assert.deepEqual(store.getState().cart_items, context.rows);
  stop();
});

test("Quantity/remove actions validate inputs and prune only the removed shop preference", () => {
  const storage = memory();
  const stop = start(storage);
  add();
  const other = menu.find((m) => m.restaurant_id !== simple.restaurant_id && !m.option_groups.length);
  add(other);
  store.getState().setPreference(simple.restaurant_id, { note: "A" });
  store.getState().setPreference(other.restaurant_id, { note: "B" });
  const row = store.getState().cart_items.find((r) => r.menu_item_id === simple.id);
  for (const invalid of [0, -1, 100, 1.5, NaN]) {
    const before = store.getState();
    assert.equal(before.updateCartItemQuantity(row.id, invalid).ok, false);
    assert.equal(store.getState(), before);
  }
  assert.equal(store.getState().updateCartItemQuantity("missing", 2).ok, false);
  assert.equal(store.getState().updateCartItemQuantity(row.id, 5).ok, true);
  const view = projectCart(store.getState().cart_items);
  assert.equal(view.items.find((i) => i.id === row.id).quantity, 5);
  assert.equal(store.getState().removeCartItem(row.id).ok, true);
  assert.equal(store.getState().preferences[simple.restaurant_id], undefined);
  assert.equal(store.getState().preferences[other.restaurant_id].note, "B");
  assert.equal(store.getState().removeCartItem(row.id).ok, false);
  assert.equal(JSON.parse(storage.getItem(key)).cart_items.length, 1);
  stop();
});

test("V1 snapshot restores without legacy UI; success uses historical prices/status", () => {
  const storage = memory();
  let stop = start(storage);
  const selected = drink.option_groups.map((g) => ({ option_id: g.options[0].id }));
  add(drink, selected);
  const order = endLatestOrder();
  const saved = JSON.parse(storage.getItem(key));
  // Explicit pre-cleanup v1 wire format; no migration or storage reset required.
  const v1 = { version: 1, customerId: initial.cart.student_id, cart: saved.cart,
    cart_items: [], orderRecords: saved.orderRecords, location: saved.location,
    address: saved.address, preferences: {}, lastCheckout: saved.lastCheckout };
  stop(); reset(); storage.data.set(key, JSON.stringify(v1));
  const originalPrice = drink.price;
  try {
    drink.price += 9999;
    stop = start(storage);
    assert.equal(store.getState().storageWarning, null);
    const result = checkoutView(store.getState());
    assert.equal(result.orders[0].id, order.id);
    assert.equal(result.orders[0].status, "completed");
    assert.equal(result.orders[0].items[0].unitPrice, order.order_items[0].unit_price_snapshot);
    assert.deepEqual(result.orders[0].items[0].optionSnapshots, order.order_items[0].option_snapshot_price);
    assert.equal(result.orders[0].total, order.total);
    assert.equal(getCheckoutView(saved.orderRecords, "other-customer", saved.lastCheckout).orders.length, 0);
  } finally { drink.price = originalPrice; stop(); }
});

console.log(`${passed} storage/reorder tests passed.`);
