/* eslint-disable @typescript-eslint/no-require-imports */
// Reuse the TS runner and run customer regression tests before seller tests.
require("./test-student-storage.cjs");
const assert = require("node:assert/strict");
const { createSellerOrderFixtures, demoSellerRestaurant } = require("../lib/mocks/seller-orders.mock.ts");
const { filterSellerOrders, isInSellerTab, selectedSellerOrder, transitionSellerOrder, vietnamDay } = require("../lib/seller/orders.ts");
const now = "2026-10-05T03:30:00.000Z";
const orders = createSellerOrderFixtures(now);
const pending = orders.filter((o) => isInSellerTab(o.order_status, "pending"));
assert.equal(pending.length, 3);
assert.equal(selectedSellerOrder(pending, null), undefined);
assert.equal(selectedSellerOrder(pending, pending[0].id), pending[0]);
assert.equal(selectedSellerOrder([], pending[0].id), undefined);
assert.equal(selectedSellerOrder(pending, orders[3].id), undefined);
assert.equal(filterSellerOrders(orders, demoSellerRestaurant.id, "tran minh anh", null).length, 3);
assert.equal(filterSellerOrders(orders, demoSellerRestaurant.id, "#SF00128", null).length, 1);
assert.equal(filterSellerOrders(orders, "other-shop", "", null).length, 0);
assert.equal(filterSellerOrders(orders, demoSellerRestaurant.id, "", "2026-10-04").length, 0);
assert.equal(filterSellerOrders(orders, demoSellerRestaurant.id, "", vietnamDay(now)).length, 7);
assert.equal(orders.filter((o) => isInSellerTab(o.order_status, "cancelled")).length, 2);
const accepted = transitionSellerOrder(pending[0], "accepted", now);
assert.equal(accepted.order_status, "accepted");
assert.equal(accepted.accepted_at, now);
assert.equal(pending[0].order_status, "pending");
assert.equal(transitionSellerOrder(accepted, "pending", now), accepted);
assert.equal(transitionSellerOrder(pending[0], "completed", now), pending[0]);
const completed = transitionSellerOrder(accepted, "completed", now);
assert.equal(completed.customer.phone, null);
assert.equal(completed.completed_at, now);
assert.equal(transitionSellerOrder(pending[0], "rejected", now).order_status, "rejected");
for (const order of orders) {
  assert.equal(order.total, order.order_items.reduce((sum, i) => sum + i.unit_price_snapshot * i.quantity, 0));
  assert.ok(order.order_items.every((i) => i.order_id === order.id));
}
console.log("PASS seller filters, default/selected/hidden bill, transitions, privacy and snapshot totals");
