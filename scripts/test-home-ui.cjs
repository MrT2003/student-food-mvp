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
  previewAccount,
  previewRestaurants,
} = require("@/lib/home/mock-data");
const {
  initialHomeFilters,
  isAllHomeFilters,
  filterHomeRestaurants,
} = require("@/lib/home/useHome");
const HomeHero = require("@/components/features/home/HomeHero").default;
const HomeFilters = require("@/components/features/home/HomeFilters").default;
const RestaurantSection =
  require("@/components/features/home/RestaurantSection").default;
const ReorderSection =
  require("@/components/features/home/ReorderSection").default;
const {
  useStudentMockStore,
} = require("@/store/useStudentMockStore");
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
  assert.match(studentLayout, /<StudentBottomNavigation\s*\/>/);

  const mobileNavCss = fs.readFileSync(
    path.join(root, "styles/student-mobile-navigation.module.css"),
    "utf8",
  );
  assert.match(mobileNavCss, /env\(safe-area-inset-bottom/);
  assert.match(mobileNavCss, /@media\s*\(max-width:\s*760px\)/);
  assert.match(mobileNavCss, /@media\s*\(max-width:\s*360px\)/);

  const homeCss = fs.readFileSync(
    path.join(root, "styles/home.module.css"),
    "utf8",
  );
  assert.match(homeCss, /@media\s*\(max-width:\s*760px\)/);
  assert.match(homeCss, /@media\s*\(max-width:\s*430px\)/);
  assert.match(homeCss, /@media\s*\(max-width:\s*360px\)/);
  assert.match(
    homeCss,
    /\.restaurantGrid\[data-compact="true"\]\s*>\s*:nth-child\(n\s*\+\s*5\)/,
  );
});

test("Header preview account and initial 4 featured restaurants match mockup", () => {
  assert.equal(previewAccount.initial, "N");
  assert.equal(previewAccount.unreadCount, 3);
  assert.equal(previewRestaurants.length, 6);

  const topFour = previewRestaurants.slice(0, 4);
  assert.deepEqual(
    topFour.map((r) => ({
      name: r.name,
      location: r.location,
      categories: r.categories,
      orderCount: r.orderCount,
      status: r.operating_status,
    })),
    [
      {
        name: "Cơm Cô Ba",
        location: "KTX A",
        categories: ["Cơm", "Món Việt"],
        orderCount: 3,
        status: "open",
      },
      {
        name: "Trà Sữa Nhà Làm",
        location: "KTX B",
        categories: ["Trà sữa", "Đồ uống"],
        orderCount: 5,
        status: "open",
      },
      {
        name: "Bún Chả Hà Nội",
        location: "KTX A",
        categories: ["Bún", "Món Việt"],
        orderCount: 2,
        status: "open",
      },
      {
        name: "Mì Cay Seoul",
        location: "KTX B",
        categories: ["Món Hàn", "Ăn vặt"],
        orderCount: 4,
        status: "open",
      },
    ],
  );
});

test("Home filter and search logic (query, diacritics, openOnly, location, category, reset)", () => {
  assert.equal(isAllHomeFilters(initialHomeFilters), true);
  assert.equal(
    isAllHomeFilters({ ...initialHomeFilters, openOnly: true }),
    false,
  );
  assert.equal(
    isAllHomeFilters({ ...initialHomeFilters, location: "KTX A" }),
    false,
  );
  assert.equal(
    isAllHomeFilters({ ...initialHomeFilters, category: "Cơm" }),
    false,
  );
  assert.equal(
    isAllHomeFilters({ ...initialHomeFilters, query: "cơm" }),
    false,
  );

  // Default returns all 6 restaurants
  assert.equal(
    filterHomeRestaurants(previewRestaurants, initialHomeFilters).length,
    6,
  );

  // Location filters
  const ktxA = filterHomeRestaurants(previewRestaurants, {
    ...initialHomeFilters,
    location: "KTX A",
  });
  assert.ok(ktxA.length > 0 && ktxA.every((r) => r.location === "KTX A"));

  const ktxB = filterHomeRestaurants(previewRestaurants, {
    ...initialHomeFilters,
    location: "KTX B",
  });
  assert.ok(ktxB.length > 0 && ktxB.every((r) => r.location === "KTX B"));

  // Category filters
  const rice = filterHomeRestaurants(previewRestaurants, {
    ...initialHomeFilters,
    category: "Cơm",
  });
  assert.deepEqual(
    rice.map((r) => r.slug),
    ["com-co-ba"],
  );

  const milkTea = filterHomeRestaurants(previewRestaurants, {
    ...initialHomeFilters,
    category: "Trà sữa",
  });
  assert.deepEqual(
    milkTea.map((r) => r.slug),
    ["tra-sua-nha-lam"],
  );

  // Search without diacritics
  const searchNoDiacritics = filterHomeRestaurants(previewRestaurants, {
    ...initialHomeFilters,
    query: "bun cha ha noi",
  });
  assert.deepEqual(
    searchNoDiacritics.map((r) => r.slug),
    ["bun-cha-ha-noi"],
  );

  // Open only filter excludes closed restaurants
  const withClosed = previewRestaurants.map((r, idx) =>
    idx === 0 ? { ...r, operating_status: "closed" } : r,
  );
  assert.equal(
    filterHomeRestaurants(withClosed, {
      ...initialHomeFilters,
      openOnly: true,
    }).length,
    5,
  );

  // Empty search result
  assert.equal(
    filterHomeRestaurants(previewRestaurants, {
      ...initialHomeFilters,
      query: "mon-khong-ton-tai-xyz",
    }).length,
    0,
  );
});

test("HomeHero and HomeFilters render exact texts, placeholders, and ARIA states", () => {
  const heroHtml = renderToStaticMarkup(
    React.createElement(HomeHero, {
      input: "",
      onChange: () => {},
      onSearch: () => {},
    }),
  );
  assert.match(heroHtml, /Tìm món ngon quanh\s*<span>khu ký túc xá<\/span>/);
  assert.match(
    heroHtml,
    /Hàng trăm quán ăn ngon, giao nhanh, dành riêng cho sinh viên\./,
  );
  assert.match(heroHtml, /placeholder="Tìm quán ăn hoặc món ăn\.\.\."/);
  assert.match(heroHtml, /aria-label="Tìm kiếm"/);

  const filtersHtml = renderToStaticMarkup(
    React.createElement(HomeFilters, {
      filters: initialHomeFilters,
      onChange: () => {},
      onReset: () => {},
    }),
  );
  assert.match(filtersHtml, /aria-pressed="true"[^>]*>Tất cả<\/button>/);
  for (const label of ["Đang mở", "KTX A", "KTX B", "Cơm", "Trà sữa", "Ăn vặt"]) {
    assert.ok(filtersHtml.includes(label), `Filter pill "${label}" rendered`);
  }
});

test("RestaurantSection renders open restaurants grid and empty state", () => {
  const sectionHtml = renderToStaticMarkup(
    React.createElement(RestaurantSection, {
      restaurants: previewRestaurants,
      onSelect: () => {},
      onReset: () => {},
      searching: false,
      compact: true,
    }),
  );
  assert.match(sectionHtml, /Quán đang mở/);
  assert.match(sectionHtml, /Xem tất cả/);
  assert.match(sectionHtml, /data-compact="true"/);
  assert.match(sectionHtml, /Đang nhận đơn/);
  assert.match(sectionHtml, /Xem quán/);
  for (const name of [
    "Cơm Cô Ba",
    "Trà Sữa Nhà Làm",
    "Bún Chả Hà Nội",
    "Mì Cay Seoul",
  ]) {
    assert.ok(sectionHtml.includes(name), `Restaurant card "${name}" rendered`);
  }

  const emptyHtml = renderToStaticMarkup(
    React.createElement(RestaurantSection, {
      restaurants: [],
      onSelect: () => {},
      onReset: () => {},
      searching: true,
      compact: false,
    }),
  );
  assert.match(emptyHtml, /Kết quả tìm kiếm/);
  assert.match(emptyHtml, /Chưa tìm thấy quán phù hợp\./);
  assert.match(emptyHtml, /Xóa bộ lọc/);
});

test("ReorderSection renders preview cards by default and completed order history when present", () => {
  resetStore();
  const defaultReorderHtml = renderToStaticMarkup(
    React.createElement(ReorderSection, {
      restaurants: previewRestaurants,
      onSelect: () => {},
    }),
  );
  assert.match(defaultReorderHtml, /Đặt lại nhanh/);
  assert.match(defaultReorderHtml, /href="\/orders\/history"/);
  assert.match(defaultReorderHtml, /Đã đặt 3 lần/);
  assert.match(defaultReorderHtml, /Đã đặt 5 lần/);
  assert.match(defaultReorderHtml, /Đã đặt 2 lần/);
  assert.match(defaultReorderHtml, /Đã đặt 4 lần/);
  assert.match(defaultReorderHtml, /Cơm, Món Việt/);
  assert.match(defaultReorderHtml, /Trà sữa, Đồ uống/);
  assert.match(defaultReorderHtml, /Bún, Món Việt/);
  assert.match(defaultReorderHtml, /Món Hàn, Ăn vặt/);
  assert.match(defaultReorderHtml, /Đặt lại/);

  // Simulate a completed order and verify history mode
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
  const orderId = Object.keys(useStudentMockStore.getState().orderRecords)[0];
  const orderRecord = useStudentMockStore.getState().orderRecords[orderId];
  const updatedRecords = {
    [orderId]: { ...orderRecord, order_status: "completed" },
  };
  useStudentMockStore.setState({ orderRecords: updatedRecords });
  useStudentMockStore.getInitialState().orderRecords = updatedRecords;

  const historyReorderHtml = renderToStaticMarkup(
    React.createElement(ReorderSection, {
      restaurants: previewRestaurants,
      onSelect: () => {},
    }),
  );
  assert.match(historyReorderHtml, /Cơm Cô Ba/);
  assert.match(historyReorderHtml, /Đã đặt 1 lần/);
  assert.match(historyReorderHtml, /Đặt lại/);
  resetStore();
});

console.log(`\nAll ${passed} Home UI test suites passed!`);
