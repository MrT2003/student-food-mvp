import assert from "node:assert/strict";
import { test } from "node:test";
import { create } from "zustand";
import { load, userId, other, restaurantId } from "./seller-sdk-fixture.mjs";

const profile = (role, id = userId, status = "active") => ({ role, id, status });
const flush = () => new Promise(resolve => setImmediate(resolve));
const jsx = (type, props) => ({ type, props });

function setup(auth) {
  const authStore = create(() => auth);
  const select = store => Object.assign(selector => selector(store.getState()), store);
  const purchaseAccess = load("../lib/auth/purchase-access.ts");
  const calls = { carts: [], orders: [], errors: [] };
  const timers = new Map();
  const windowEvents = new Map();
  const documentEvents = new Map();
  const channels = new Set();
  let loadCart;
  const supabase = {
    from(table) {
      assert.equal(table, "orders");
      return {
        select() { return this; },
        eq(column, id) {
          assert.equal(column, "student_id");
          calls.orders.push(id);
          return this;
        },
        async order() { return { data: [{ id: "my-order" }], error: null }; },
      };
    },
    channel() {
      return {
        on(_event, _filter, callback) { this.refresh = callback; return this; },
        subscribe() { channels.add(this); return this; },
      };
    },
    removeChannel(channel) { channels.delete(channel); },
  };
  const { startStudentAccountScope, ...student } = load("../store/useStudentMockStore.ts", {
    zustand: { create },
    "@/store/useAuthStore": { useAuthStore: select(authStore) },
    "@/lib/auth/purchase-access": purchaseAccess,
    "@/lib/supabase/client": { createClient: () => supabase },
    "@/services/cart.service": { CartServices: { getCart(id) { calls.carts.push(id); return loadCart?.(id) ?? Promise.resolve({
      cart: { id: "db-cart", student_id: id }, items: [{ id: "db-item", restaurantId, quantity: 1, extras: [] }],
    }); } } },
    "@/services/order.service": {},
    "@/utilities/cart_order.utility": {},
    "@/lib/cart/view-model": {},
    "@/lib/cart/calculations": {},
    "@/lib/mocks/catalog.mock": {},
    "@/lib/cart/options": {},
    "@/lib/mocks/checkout.mock": {},
    "@/lib/orders/reorder": {},
    "@/lib/mocks/student-storage": { studentStorageKey: () => "guest" },
  }, { console: { error: (...args) => calls.errors.push(args) } });
  const store = student.useStudentMockStore;
  const stopScope = startStudentAccountScope();
  const effects = [];
  let effectIndex = 0;
  const boundary = load("../components/layout/StudentStorageBoundary.tsx", {
    react: { useEffect(run, deps) {
      const idx = effectIndex++;
      const previous = effects[idx];
      if (previous?.deps.every((value, i) => Object.is(value, deps[i]))) return;
      effects[idx] = { deps, run, pending: true, cleanup: previous?.cleanup };
    } },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/lib/auth/purchase-access": purchaseAccess,
    "@/lib/supabase/client": { createClient: () => supabase },
    "@/store/useAuthStore": { useAuthStore: select(authStore) },
    "@/store/useStudentMockStore": { ...student, useStudentMockStore: select(store) },
  }, {
    window: {
      localStorage: { getItem: () => null, setItem() {} },
      setInterval(callback, delay) { assert.equal(delay, 5000); timers.set(callback, callback); return callback; },
      clearInterval: id => timers.delete(id),
      addEventListener: (event, callback) => windowEvents.set(event, callback),
      removeEventListener: event => windowEvents.delete(event),
    },
    document: {
      visibilityState: "visible",
      addEventListener: (event, callback) => documentEvents.set(event, callback),
      removeEventListener: event => documentEvents.delete(event),
    },
    navigator: { onLine: true },
  }).default;
  const layout = load("../app/(student)/layout.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/components/layout/StudentStorageBoundary": { default: boundary },
    "@/components/layout/StudentHeader": { default: "header" },
    "@/components/layout/StudentBottomNavigation": { default: "navigation" },
    "@/styles/home.module.css": { default: {} },
    "@/styles/student-mobile-navigation.module.css": { default: {} },
  }).default;
  function renderAccount() {
    const tree = layout({ children: "account" });
    effectIndex = 0;
    const rendered = tree.type(tree.props);
    for (const effect of effects) {
      if (!effect.pending) continue;
      effect.pending = false;
      effect.cleanup?.();
      effect.cleanup = effect.run();
    }
    return rendered;
  }
  function refreshSources() {
    for (const callback of timers.values()) callback();
    windowEvents.get("focus")?.();
    windowEvents.get("online")?.();
    documentEvents.get("visibilitychange")?.();
    for (const channel of channels) channel.refresh();
  }
  return {
    renderAccount, refreshSources, calls, store, authStore, timers, windowEvents, documentEvents, channels,
    mockCart(fn) { loadCart = fn; },
    close() { for (const effect of effects) effect.cleanup?.(); stopScope(); },
  };
}

test("seller opening account never syncs cart or registers purchase refresh sources", () => {
  const f = setup({ status: "ready", user: profile("seller") });
  f.renderAccount(); // Hydrate local storage.
  assert.ok(f.renderAccount().props.children.includes("account") ||
    f.renderAccount().props.children.some(child => child?.type === "div"));
  f.refreshSources();
  assert.deepEqual(f.calls.carts, []);
  assert.deepEqual(f.calls.orders, []);
  assert.equal(f.timers.size + f.windowEvents.size + f.documentEvents.size + f.channels.size, 0);
  f.close();
});

for (const role of ["student", "staff"]) test(role + " waits for auth, then syncs cart and orders from every refresh source", async () => {
  const f = setup({ status: "loading", user: profile(role) });
  f.renderAccount();
  f.renderAccount();
  assert.deepEqual(f.calls.carts, []);
  f.authStore.setState({ status: "ready" });
  f.renderAccount();
  await flush();
  f.refreshSources();
  await flush();
  assert.deepEqual(f.calls.carts, Array(6).fill(userId));
  assert.deepEqual(f.calls.orders, Array(6).fill(userId));
  assert.equal(f.store.getState().cart_items[0].id, "db-item");
  assert.ok(f.store.getState().orderRecords["my-order"]);
  f.close();
});

test("same-ID seller transition removes purchase listeners, restores guest cart and ignores late response", async () => {
  const f = setup({ status: "ready", user: profile("staff") });
  f.store.setState({ cart_items: [{ id: "guest-item" }] });
  f.renderAccount();
  f.renderAccount();
  await flush();
  assert.equal(f.store.getState().cart_items[0].id, "db-item");
  let finish;
  f.mockCart(() => new Promise(resolve => { finish = resolve; }));
  const lateCallback = f.windowEvents.get("focus");
  lateCallback();
  f.authStore.setState({ user: profile("seller") });
  lateCallback(); // Also guard callbacks queued before React runs cleanup.
  f.renderAccount();
  f.refreshSources();
  finish({ cart: { student_id: userId }, items: [{ id: "late", extras: [] }] });
  await flush();
  assert.equal(f.calls.carts.length, 2);
  assert.equal(f.timers.size + f.windowEvents.size + f.documentEvents.size + f.channels.size, 0);
  assert.equal(f.store.getState().serverCart, null);
  assert.equal(f.store.getState().cart_items[0].id, "guest-item");
  assert.equal(Object.keys(f.store.getState().orderRecords).length, 0);
  f.close();
});

test("switching accounts or relogging invalidates the earlier result and genuine query errors still log", async () => {
  const f = setup({ status: "ready", user: profile("student") });
  let finish;
  f.mockCart(() => new Promise(resolve => { finish = resolve; }));
  f.renderAccount();
  f.renderAccount();
  f.authStore.setState({ user: profile("student", other) });
  f.authStore.setState({ user: null });
  f.authStore.setState({ user: profile("student") });
  finish({ cart: { student_id: userId }, items: [] });
  await flush();
  assert.equal(f.store.getState().serverCart, null);
  f.mockCart(() => Promise.reject(Error("query failure")));
  await f.store.getState().syncFromDatabase();
  assert.equal(f.calls.errors.length, 1);
  assert.match(f.calls.errors[0][1].message, /query failure/);
  f.close();
});
