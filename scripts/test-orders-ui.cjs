/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    const mapped = path.join(root, request.slice(2));
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".css"] = (module, filename) => {
  const css = fs.readFileSync(filename, "utf8");
  const proxy = new Proxy(
    { __rawCss: css, __esModule: true },
    {
      get(target, prop) {
        if (prop === "default") return proxy;
        if (prop in target) return target[prop];
        return String(prop);
      },
    },
  );
  module.exports = proxy;
};

const compileTs = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
};

require.extensions[".ts"] = compileTs;
require.extensions[".tsx"] = compileTs;

const {
  defaultOrderSummaryCounts,
  initialOrderFilters,
  orderStatusTabs,
  orderDateOptions,
  previewOrders,
  isAllOrdersFilter,
  filterOrderCards,
  cancelPendingOrder,
  toOrderCardViewModel,
} = require("@/components/features/orders/orders-mock-data");
const OrdersHero = require("@/components/features/orders/OrdersHero").default;
const OrdersFilterBar =
  require("@/components/features/orders/OrdersFilterBar").default;
const CurrentOrderCard =
  require("@/components/features/orders/CurrentOrderCard").default;
const HistoryOrderCard =
  require("@/components/features/orders/HistoryOrderCard").default;
const OrdersView = require("@/components/features/orders/OrdersView").default;
const { useStudentMockStore } = require("@/store/useStudentMockStore");
const { mockMenuItemDetails } = require("@/lib/mocks/catalog.mock");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`PASS: ${name}`);
}

const initialStoreState = useStudentMockStore.getState();
const resetStore = () => {
  useStudentMockStore.setState(initialStoreState, true);
  useStudentMockStore.getInitialState().orderRecords =
    initialStoreState.orderRecords;
};

test("Design tokens, font family, and mobile viewport / safe-area configuration", () => {
  const globalsCss = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(globalsCss, /--sf-page:\s*#f8f4ee/i, "Cream page background token");
  assert.match(globalsCss, /--sf-card:\s*#ffffff/i, "White card token");
  assert.match(globalsCss, /--sf-ink:\s*#081447/i, "Navy ink text token");
  assert.match(globalsCss, /--sf-orange:\s*#ff4d12/i, "Orange accent #ff4d12 token");
  assert.match(
    globalsCss,
    /font-family:\s*Arial,\s*Helvetica,\s*sans-serif/i,
    "Arial/Helvetica font family",
  );

  const studentLayout = fs.readFileSync(
    path.join(root, "app/(student)/layout.tsx"),
    "utf8",
  );
  assert.match(studentLayout, /width:\s*"device-width"/);
  assert.match(studentLayout, /initialScale:\s*1/);
  assert.match(studentLayout, /viewportFit:\s*"cover"/);
  assert.match(studentLayout, /<StudentHeader\s*\/>/);
  assert.match(studentLayout, /<StudentBottomNavigation\s*\/>/);

  const mobileNavCss = fs.readFileSync(
    path.join(root, "styles/student-mobile-navigation.module.css"),
    "utf8",
  );
  assert.match(mobileNavCss, /env\(safe-area-inset-bottom/);
  assert.match(mobileNavCss, /@media\s*\(max-width:\s*760px\)/);
  assert.match(mobileNavCss, /@media\s*\(max-width:\s*360px\)/);

  const ordersCss = fs.readFileSync(
    path.join(root, "styles/orders.module.css"),
    "utf8",
  );
  assert.match(ordersCss, /@media\s*\(max-width:\s*760px\)/);
  assert.match(ordersCss, /@media\s*\(max-width:\s*430px\)/);
  assert.match(ordersCss, /@media\s*\(max-width:\s*380px\)/);
  assert.match(ordersCss, /@media\s*\(max-width:\s*360px\)/);
});

test("Summary statistics and preview orders match the attached mockup 100%", () => {
  assert.deepEqual(defaultOrderSummaryCounts, {
    pending: 3,
    accepted: 5,
    completed: 18,
    cancelled: 2,
  });

  const { current, history } = filterOrderCards(
    previewOrders,
    initialOrderFilters,
  );
  assert.equal(current.length, 2, "2 current orders in section heading");
  assert.equal(history.length, 3, "3 history orders in section heading");

  assert.deepEqual(
    current.map((o) => ({
      orderCode: o.orderCode,
      restaurantName: o.restaurantName,
      location: o.location,
      status: o.status,
      itemCount: o.itemCount,
      paymentShort: o.paymentShort,
      firstItem: o.firstItem,
      otherItemCount: o.otherItemCount,
      total: o.total,
    })),
    [
      {
        orderCode: "SF0123",
        restaurantName: "Cơm Cô Ba",
        location: "KTX A",
        status: "pending",
        itemCount: 2,
        paymentShort: "Chuyển khoản",
        firstItem: "Cơm gà chiên",
        otherItemCount: 1,
        total: 100000,
      },
      {
        orderCode: "SF0124",
        restaurantName: "Trà Sữa Nhà Làm",
        location: "KTX B",
        status: "accepted",
        itemCount: 2,
        paymentShort: "Thanh toán khi nhận",
        firstItem: "Trà sữa truyền thống",
        otherItemCount: 1,
        total: 45000,
      },
    ],
  );

  assert.deepEqual(
    history.slice(0, 2).map((o) => ({
      orderCode: o.orderCode,
      restaurantName: o.restaurantName,
      status: o.status,
      dateShort: o.dateShort,
      itemCount: o.itemCount,
      paymentShort: o.paymentShort,
      total: o.total,
    })),
    [
      {
        orderCode: "SF0101",
        restaurantName: "Bún Chả Hà Nội",
        status: "completed",
        dateShort: "06/09/2026",
        itemCount: 1,
        paymentShort: "Tiền mặt",
        total: 52000,
      },
      {
        orderCode: "SF0098",
        restaurantName: "Mì Cay Seoul",
        status: "cancelled",
        dateShort: "04/09/2026",
        itemCount: 2,
        paymentShort: "Tiền mặt",
        total: 65000,
      },
    ],
  );
});

test("Order filter, search (code/restaurant/diacritics), date filter, and cancel logic", () => {
  assert.equal(isAllOrdersFilter(initialOrderFilters), true);
  assert.equal(
    isAllOrdersFilter({ ...initialOrderFilters, status: "pending" }),
    false,
  );
  assert.equal(
    isAllOrdersFilter({ ...initialOrderFilters, query: "SF0123" }),
    false,
  );

  // Filter by each status tab
  const pendingOnly = filterOrderCards(previewOrders, { status: "pending" });
  assert.deepEqual(
    pendingOnly.all.map((o) => o.orderCode),
    ["SF0123"],
  );

  const acceptedOnly = filterOrderCards(previewOrders, { status: "accepted" });
  assert.deepEqual(
    acceptedOnly.all.map((o) => o.orderCode),
    ["SF0124"],
  );

  const completedOnly = filterOrderCards(previewOrders, { status: "completed" });
  assert.deepEqual(
    completedOnly.all.map((o) => o.orderCode),
    ["SF0101", "SF0095"],
  );

  const cancelledOnly = filterOrderCards(previewOrders, { status: "cancelled" });
  assert.deepEqual(
    cancelledOnly.all.map((o) => o.orderCode),
    ["SF0098"],
  );

  // Search by order code with '#' prefix
  const byOrderCode = filterOrderCards(previewOrders, { query: "#SF0124" });
  assert.deepEqual(
    byOrderCode.all.map((o) => o.orderCode),
    ["SF0124"],
  );

  // Search by restaurant name without diacritics
  const byRestaurantNoDiacritics = filterOrderCards(previewOrders, {
    query: "bun cha ha noi",
  });
  assert.deepEqual(
    byRestaurantNoDiacritics.all.map((o) => o.orderCode),
    ["SF0101"],
  );

  // Date filter with older custom orders
  const customTimedOrders = [
    {
      ...previewOrders[0],
      isToday: false,
      createdAt: "2026-09-06T08:00:00.000Z",
    },
    {
      ...previewOrders[1],
      isToday: false,
      createdAt: "2026-09-02T08:00:00.000Z",
    },
    {
      ...previewOrders[2],
      isToday: false,
      createdAt: "2026-08-15T08:00:00.000Z",
    },
  ];
  const refIso = "2026-09-06T12:00:00.000Z";
  assert.equal(
    filterOrderCards(customTimedOrders, { dateFilter: "today" }, refIso).all
      .length,
    1,
  );
  assert.equal(
    filterOrderCards(customTimedOrders, { dateFilter: "7days" }, refIso).all
      .length,
    2,
  );
  assert.equal(
    filterOrderCards(customTimedOrders, { dateFilter: "30days" }, refIso).all
      .length,
    3,
  );

  // Cancel pending order transitions status and updates summary counts
  const cancelResult = cancelPendingOrder(
    previewOrders,
    defaultOrderSummaryCounts,
    "SF0123",
  );
  assert.ok(cancelResult.cancelledOrder);
  assert.equal(cancelResult.cancelledOrder.status, "cancelled");
  assert.equal(cancelResult.counts.pending, 2);
  assert.equal(cancelResult.counts.cancelled, 3);

  // Non-pending order cannot be cancelled
  const nonPendingCancel = cancelPendingOrder(
    previewOrders,
    defaultOrderSummaryCounts,
    "SF0124",
  );
  assert.equal(nonPendingCancel.cancelledOrder, null);
});

test("OrdersHero and OrdersFilterBar render exact texts, tabs, search box, date filter, and 4 summary cards", () => {
  const heroHtml = renderToStaticMarkup(React.createElement(OrdersHero));
  assert.match(heroHtml, /Đơn hàng của tôi/);
  assert.match(
    heroHtml,
    /Theo dõi các đơn hàng hiện tại và xem lại lịch sử đặt món của bạn\./,
  );

  const filterBarHtml = renderToStaticMarkup(
    React.createElement(OrdersFilterBar, {
      status: "all",
      query: "",
      dateFilter: "today",
      summaryCounts: defaultOrderSummaryCounts,
      onStatusChange: () => {},
      onQueryChange: () => {},
      onDateFilterChange: () => {},
    }),
  );

  assert.match(filterBarHtml, /aria-pressed="true"[^>]*>Tất cả<\/button>/);
  for (const tab of orderStatusTabs) {
    assert.ok(
      filterBarHtml.includes(tab.label),
      `Status tab "${tab.label}" rendered`,
    );
  }
  assert.match(
    filterBarHtml,
    /placeholder="Tìm theo mã đơn hoặc tên quán\.\.\."/,
  );
  for (const opt of orderDateOptions) {
    assert.ok(
      filterBarHtml.includes(opt.label),
      `Date option "${opt.label}" rendered`,
    );
  }
  assert.match(filterBarHtml, />3<\/strong>/);
  assert.match(filterBarHtml, />5<\/strong>/);
  assert.match(filterBarHtml, />18<\/strong>/);
  assert.match(filterBarHtml, />2<\/strong>/);
});

test("CurrentOrderCard and HistoryOrderCard render exact mockup content and action buttons", () => {
  const pendingCardHtml = renderToStaticMarkup(
    React.createElement(CurrentOrderCard, {
      order: previewOrders[0],
      onCancel: () => {},
      onContact: () => {},
    }),
  );
  assert.match(pendingCardHtml, /Cơm Cô Ba/);
  assert.match(pendingCardHtml, /Đang chờ xác nhận/);
  assert.match(pendingCardHtml, /Đơn hàng #SF0123/);
  assert.match(pendingCardHtml, /KTX A/);
  assert.match(pendingCardHtml, /2 món/);
  assert.match(pendingCardHtml, /Chuyển khoản/);
  assert.match(pendingCardHtml, /Cơm gà chiên/);
  assert.match(pendingCardHtml, /và 1 món khác/);
  assert.match(pendingCardHtml, /Tổng tiền/);
  assert.match(pendingCardHtml, /100\.000đ/);
  assert.match(pendingCardHtml, /Hủy đơn/);
  assert.match(pendingCardHtml, /Xem chi tiết/);

  const acceptedCardHtml = renderToStaticMarkup(
    React.createElement(CurrentOrderCard, {
      order: previewOrders[1],
      onCancel: () => {},
      onContact: () => {},
    }),
  );
  assert.match(acceptedCardHtml, /Trà Sữa Nhà Làm/);
  assert.match(acceptedCardHtml, /Đã chấp nhận/);
  assert.match(acceptedCardHtml, /Đơn hàng #SF0124/);
  assert.match(acceptedCardHtml, /KTX B/);
  assert.match(acceptedCardHtml, /2 món/);
  assert.match(acceptedCardHtml, /Thanh toán khi nhận/);
  assert.match(acceptedCardHtml, /Trà sữa truyền thống/);
  assert.match(acceptedCardHtml, /và 1 món khác/);
  assert.match(acceptedCardHtml, /45\.000đ/);
  assert.match(acceptedCardHtml, /Liên hệ quán/);
  assert.match(acceptedCardHtml, /Xem chi tiết/);

  const completedHistoryHtml = renderToStaticMarkup(
    React.createElement(HistoryOrderCard, {
      order: previewOrders[2],
      onAction: () => {},
      added: false,
    }),
  );
  assert.match(completedHistoryHtml, /Bún Chả Hà Nội/);
  assert.match(completedHistoryHtml, /Hoàn thành/);
  assert.match(completedHistoryHtml, /Đơn hàng #SF0101/);
  assert.match(completedHistoryHtml, /06\/09\/2026/);
  assert.match(completedHistoryHtml, /1 món/);
  assert.match(completedHistoryHtml, /Tiền mặt/);
  assert.match(completedHistoryHtml, /52\.000đ/);
  assert.match(completedHistoryHtml, /Xem chi tiết/);
  assert.match(completedHistoryHtml, /class="primaryButton"[^>]*>.*Đặt lại/);

  const cancelledHistoryHtml = renderToStaticMarkup(
    React.createElement(HistoryOrderCard, {
      order: previewOrders[3],
      onAction: () => {},
      added: false,
    }),
  );
  assert.match(cancelledHistoryHtml, /Mì Cay Seoul/);
  assert.match(cancelledHistoryHtml, /Đã hủy/);
  assert.match(cancelledHistoryHtml, /Đơn hàng #SF0098/);
  assert.match(cancelledHistoryHtml, /04\/09\/2026/);
  assert.match(cancelledHistoryHtml, /2 món/);
  assert.match(cancelledHistoryHtml, /Tiền mặt/);
  assert.match(cancelledHistoryHtml, /65\.000đ/);
  assert.match(cancelledHistoryHtml, /Xem chi tiết/);
  assert.match(cancelledHistoryHtml, /class="outlineButton"[^>]*>.*Đặt lại/);
});

test("Full OrdersView renders both sections, counts (2) and (3), 'Xem tất cả' link, and integrates with store orders", () => {
  resetStore();
  const fullHtml = renderToStaticMarkup(React.createElement(OrdersView));
  assert.match(fullHtml, /Đơn hàng của tôi/);
  assert.match(fullHtml, /Đơn hàng hiện tại/);
  assert.match(fullHtml, /\(2\)/);
  assert.match(fullHtml, /Lịch sử đơn hàng/);
  assert.match(fullHtml, /\(3\)/);
  assert.match(fullHtml, /href="\/orders\/history"/);
  assert.match(fullHtml, /Xem tất cả/);
  assert.match(fullHtml, /Cơm Cô Ba/);
  assert.match(fullHtml, /Trà Sữa Nhà Làm/);
  assert.match(fullHtml, /Bún Chả Hà Nội/);
  assert.match(fullHtml, /Mì Cay Seoul/);

  // Simulate a store checkout and verify OrdersView renders store orders
  const simpleItem = mockMenuItemDetails.find(
    (item) => item.option_groups.length === 0,
  );
  useStudentMockStore.getState().addCatalogItem({
    menu_item_id: simpleItem.id,
    restaurant_id: simpleItem.restaurant_id,
    quantity: 2,
    selected_options: [],
  });
  useStudentMockStore.getState().setAddress("Phòng 204");
  const checkout = useStudentMockStore.getState().checkoutCart();
  assert.equal(checkout.ok, true);
  useStudentMockStore.getInitialState().orderRecords =
    useStudentMockStore.getState().orderRecords;

  const { toOrderDetail } = require("@/lib/orders/order-mappers");
  const rawOrder = Object.values(useStudentMockStore.getState().orderRecords)[0];
  const mappedCard = toOrderCardViewModel(toOrderDetail(rawOrder));
  assert.equal(mappedCard.restaurantName, "Cơm Cô Ba");
  assert.equal(mappedCard.orderCode, "SF-01-0001");

  const storeHtml = renderToStaticMarkup(React.createElement(OrdersView));
  assert.match(storeHtml, /Cơm Cô Ba/);
  assert.match(storeHtml, /SF-01-0001/);
  resetStore();
});

console.log(`\nAll ${passed} Orders UI test suites passed!`);
