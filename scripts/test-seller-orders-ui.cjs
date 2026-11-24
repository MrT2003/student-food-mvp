/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalLoad = Module._load;

function resolveLocalFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function createCssModuleProxy(filePath) {
  const cssContent = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";
  const proxy = new Proxy(
    { __rawCss: cssContent, __esModule: true },
    {
      get(target, property) {
        if (property === "default") return proxy;
        if (property in target) return target[property];
        return String(property);
      },
    },
  );
  return proxy;
}

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "next/link") {
    return function MockNextLink({ href, children, ...props }) {
      const resolvedHref =
        typeof href === "string" ? href : href?.pathname || "#";
      return React.createElement("a", { href: resolvedHref, ...props }, children);
    };
  }

  if (request === "next/image") {
    return function MockNextImage({ src, alt, ...props }) {
      return React.createElement("img", { src, alt: alt || "", ...props });
    };
  }

  if (request === "next/navigation") {
    return {
      useRouter: () => ({
        push() {},
        replace() {},
        prefetch() {},
        back() {},
      }),
      usePathname: () => "/seller/orders",
      useSearchParams: () => new URLSearchParams(),
    };
  }

  if (request.endsWith(".css")) {
    const resolvedCss = request.startsWith("@/")
      ? path.join(projectRoot, request.slice(2))
      : path.resolve(path.dirname(parent.filename), request);
    return createCssModuleProxy(resolvedCss);
  }

  if (request.startsWith("@/")) {
    const resolved = resolveLocalFile(path.join(projectRoot, request.slice(2)));
    if (resolved) {
      return originalLoad.call(this, resolved, parent, isMain);
    }
  }

  if (request.startsWith(".")) {
    const resolved = resolveLocalFile(
      path.resolve(path.dirname(parent.filename), request),
    );
    if (resolved) {
      return originalLoad.call(this, resolved, parent, isMain);
    }
  }

  return originalLoad.call(this, request, parent, isMain);
};

function compileTsModule(filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  return outputText;
}

require.extensions[".ts"] = function registerTs(module, filename) {
  module._compile(compileTsModule(filename), filename);
};

require.extensions[".tsx"] = function registerTsx(module, filename) {
  module._compile(compileTsModule(filename), filename);
};

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

global.window = {
  sessionStorage: createMemoryStorage(),
  localStorage: createMemoryStorage(),
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
};
global.sessionStorage = global.window.sessionStorage;
global.localStorage = global.window.localStorage;
global.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type;
  }
};

const sellerLayout = require(
  path.join(projectRoot, "app/(seller)/layout.tsx"),
);
const {
  default: SellerBottomNavigation,
} = require(
  path.join(projectRoot, "components/features/seller/SellerBottomNavigation.tsx"),
);
const {
  default: SellerOrdersView,
  SELLER_MOBILE_REFERENCE_DAY,
  sellerMobileOrderTabs,
  sellerMobileDateFilterOptions,
  sellerMobileSortOptions,
  createSellerMobileOrderFixtures,
  formatMobileOrderTime,
  splitMobileDeliveryAddress,
  formatMobileOrderItemsSummary,
  getMobileOrderNoteBadge,
  getSellerMobileTabCounts,
  filterAndSortSellerMobileOrders,
} = require(
  path.join(projectRoot, "components/features/seller/SellerOrdersView.tsx"),
);
const {
  transitionSellerOrder,
} = require(path.join(projectRoot, "lib/seller/orders.ts"));
const {
  useSellerPreviewStore,
} = require(path.join(projectRoot, "store/useSellerPreviewStore.ts"));

function testViewportAndResponsiveOrderStyles() {
  assert.equal(sellerLayout.viewport.width, "device-width");
  assert.equal(sellerLayout.viewport.initialScale, 1);
  assert.equal(sellerLayout.viewport.viewportFit, "cover");

  const ordersCss = fs.readFileSync(
    path.join(projectRoot, "styles/seller-orders.module.css"),
    "utf8",
  );
  assert.match(ordersCss, /\.desktopView\s*\{\s*display:\s*contents;\s*\}/);
  assert.match(ordersCss, /\.mobileView\s*\{\s*display:\s*none;\s*\}/);
  assert.match(ordersCss, /env\(safe-area-inset-bottom/);
  assert.match(ordersCss, /@media \(max-width: 760px\)/);
  assert.match(ordersCss, /@media \(max-width: 440px\)/);
  assert.match(ordersCss, /@media \(max-width: 393px\)/);
  assert.match(ordersCss, /@media \(max-width: 360px\)/);

  const mobileNavCss = fs.readFileSync(
    path.join(projectRoot, "styles/seller-mobile-navigation.module.css"),
    "utf8",
  );
  assert.match(mobileNavCss, /\.badge\s*\{/);
  assert.match(mobileNavCss, /\.iconWrap\s*\{/);
}

function testMobileFixturesAndFilterSortLogic() {
  const fixtures = createSellerMobileOrderFixtures();
  const counts = getSellerMobileTabCounts(fixtures);

  assert.deepEqual(counts, {
    pending: 3,
    accepted: 5,
    completed: 18,
    cancelled: 2,
  });

  assert.deepEqual(
    sellerMobileOrderTabs.map((t) => [t.value, t.label]),
    [
      ["pending", "Chờ xác nhận"],
      ["accepted", "Đã nhận"],
      ["completed", "Hoàn thành"],
      ["cancelled", "Đã hủy"],
    ],
  );
  assert.deepEqual(
    sellerMobileDateFilterOptions.map((o) => [o.value, o.label]),
    [
      ["today", "Hôm nay"],
      ["all", "Tất cả ngày"],
    ],
  );
  assert.deepEqual(
    sellerMobileSortOptions.map((o) => [o.value, o.label]),
    [
      ["newest", "Mới nhất trước"],
      ["oldest", "Cũ nhất trước"],
    ],
  );

  const pendingNewest = filterAndSortSellerMobileOrders(fixtures, {
    tab: "pending",
    query: "",
    period: "today",
    sort: "newest",
    day: SELLER_MOBILE_REFERENCE_DAY,
  });
  assert.deepEqual(
    pendingNewest.map((o) => o.order_code),
    ["SF0128", "SF0129", "SF0130"],
  );

  // Check card 1 (#SF0128) details
  assert.equal(pendingNewest[0].total, 45000);
  assert.equal(formatMobileOrderTime(pendingNewest[0].created_at), "10:24");
  assert.equal(pendingNewest[0].customer.name, "Trần Minh Anh");
  assert.deepEqual(
    splitMobileDeliveryAddress(pendingNewest[0].delivery_address),
    { area: "KTX A", detail: "Cổng B, Phòng 302" },
  );
  assert.equal(
    formatMobileOrderItemsSummary(pendingNewest[0].order_items),
    "1× Trà sữa truyền thống · 1× Bánh tráng trộn",
  );
  assert.equal(getMobileOrderNoteBadge(pendingNewest[0]), "Có tùy chọn món");
  assert.equal(pendingNewest[0].payment_method, "cash");

  // Check card 2 (#SF0129) details
  assert.equal(pendingNewest[1].total, 28000);
  assert.equal(formatMobileOrderTime(pendingNewest[1].created_at), "09:56");
  assert.equal(pendingNewest[1].customer.name, "Lê Quốc Bảo");
  assert.deepEqual(
    splitMobileDeliveryAddress(pendingNewest[1].delivery_address),
    { area: "KTX C", detail: "Tòa C1, Phòng 410" },
  );
  assert.equal(
    formatMobileOrderItemsSummary(pendingNewest[1].order_items),
    "1× Cơm gà xối mỡ",
  );
  assert.equal(getMobileOrderNoteBadge(pendingNewest[1]), null);
  assert.equal(pendingNewest[1].payment_method, "cash");

  // Check card 3 (#SF0130) details
  assert.equal(pendingNewest[2].total, 62000);
  assert.equal(formatMobileOrderTime(pendingNewest[2].created_at), "09:20");
  assert.equal(pendingNewest[2].customer.name, "Phạm Thị Mai");
  assert.deepEqual(
    splitMobileDeliveryAddress(pendingNewest[2].delivery_address),
    { area: "KTX B", detail: "Tòa B2, Phòng 205" },
  );
  assert.equal(
    formatMobileOrderItemsSummary(pendingNewest[2].order_items),
    "1× Bún bò Huế · 1× Trà tắc · +1 món",
  );
  assert.equal(getMobileOrderNoteBadge(pendingNewest[2]), "Có ghi chú");
  assert.equal(pendingNewest[2].payment_method, "bank_transfer");

  // Oldest sort order
  const pendingOldest = filterAndSortSellerMobileOrders(fixtures, {
    tab: "pending",
    query: "",
    period: "today",
    sort: "oldest",
    day: SELLER_MOBILE_REFERENCE_DAY,
  });
  assert.deepEqual(
    pendingOldest.map((o) => o.order_code),
    ["SF0130", "SF0129", "SF0128"],
  );

  // Search by order code & customer name (diacritic-insensitive)
  const byCode = filterAndSortSellerMobileOrders(fixtures, {
    tab: "pending",
    query: "#SF0129",
    period: "today",
    sort: "newest",
  });
  assert.deepEqual(
    byCode.map((o) => o.order_code),
    ["SF0129"],
  );

  const byCustomer = filterAndSortSellerMobileOrders(fixtures, {
    tab: "pending",
    query: "pham thi mai",
    period: "today",
    sort: "newest",
  });
  assert.deepEqual(
    byCustomer.map((o) => o.order_code),
    ["SF0130"],
  );

  // Status transition updates pending count from 3 to 2
  const updatedAfterAccept = fixtures.map((o) =>
    o.order_code === "SF0128"
      ? transitionSellerOrder(o, "accepted", "2026-10-05T03:30:00.000Z")
      : o,
  );
  const updatedCounts = getSellerMobileTabCounts(updatedAfterAccept);
  assert.equal(updatedCounts.pending, 2);
  assert.equal(updatedCounts.accepted, 6);
}

function testBottomNavigationPendingBadge() {
  const navHtml = renderToStaticMarkup(
    React.createElement(SellerBottomNavigation, {
      active: "orders",
      pendingOrderCount: 3,
      menuLabel: "Thực đơn",
    }),
  );
  assert.ok(navHtml.includes('data-testid="seller-orders-nav-badge"'));
  assert.ok(navHtml.includes('aria-label="3 đơn chờ xác nhận"'));
  assert.ok(navHtml.includes(">3</span>"));
  assert.ok(navHtml.includes("Tổng quan"));
  assert.ok(navHtml.includes("Đơn hàng"));
  assert.ok(navHtml.includes("Thực đơn"));
  assert.ok(navHtml.includes("Cửa hàng"));

  // When pendingOrderCount is 0, badge must not be rendered
  const zeroBadgeHtml = renderToStaticMarkup(
    React.createElement(SellerBottomNavigation, {
      active: "orders",
      pendingOrderCount: 0,
      menuLabel: "Thực đơn",
    }),
  );
  assert.equal(
    zeroBadgeHtml.includes('data-testid="seller-orders-nav-badge"'),
    false,
  );
}

function testSellerOrdersViewMarkup() {
  useSellerPreviewStore.setState({ draft: null });
  useSellerPreviewStore.getInitialState().draft = null;

  const html = renderToStaticMarkup(React.createElement(SellerOrdersView));

  // Both Desktop & Mobile views exist so Desktop UI is 100% preserved
  assert.ok(
    html.includes('class="desktopView"'),
    "Desktop view container must be preserved",
  );
  assert.ok(
    html.includes('class="mobileView"'),
    "Mobile view container must be rendered",
  );

  // Desktop specific content preserved
  assert.ok(html.includes("Theo dõi và xử lý đơn hàng của cửa hàng bạn."));
  assert.ok(html.includes("Chỉ hiển thị một trạng thái"));

  // Mobile Heading & Controls matching mockup 100%
  assert.ok(html.includes("Đơn hàng"));
  assert.ok(html.includes("Theo dõi và xử lý đơn của cửa hàng."));
  assert.ok(html.includes('placeholder="Tìm mã đơn hoặc tên khách"'));
  assert.ok(html.includes("Hôm nay"));
  assert.ok(html.includes("Mới nhất trước"));

  // Mobile Quick Status Tabs with counts: Chờ xác nhận 3, Đã nhận 5, Hoàn thành 18, Đã hủy 2
  assert.match(html, /<span>Chờ xác nhận<\/span>\s*<span class="mobileTabCount">3<\/span>/);
  assert.match(html, /<span>Đã nhận<\/span>\s*<span class="mobileTabCount">5<\/span>/);
  assert.match(html, /<span>Hoàn thành<\/span>\s*<span class="mobileTabCount">18<\/span>/);
  assert.match(html, /<span>Đã hủy<\/span>\s*<span class="mobileTabCount">2<\/span>/);

  // Card 1: #SF0128
  assert.ok(html.includes("#SF0128"));
  assert.ok(html.includes("45.000đ"));
  assert.ok(html.includes("10:24"));
  assert.ok(html.includes("Trần Minh Anh"));
  assert.ok(html.includes("<strong>KTX A</strong> · Cổng B, Phòng 302"));
  assert.ok(html.includes("1× Trà sữa truyền thống · 1× Bánh tráng trộn"));
  assert.ok(html.includes("Có tùy chọn món"));
  assert.ok(html.includes("Tiền mặt"));

  // Card 2: #SF0129
  assert.ok(html.includes("#SF0129"));
  assert.ok(html.includes("28.000đ"));
  assert.ok(html.includes("09:56"));
  assert.ok(html.includes("Lê Quốc Bảo"));
  assert.ok(html.includes("<strong>KTX C</strong> · Tòa C1, Phòng 410"));
  assert.ok(html.includes("1× Cơm gà xối mỡ"));

  // Card 3: #SF0130
  assert.ok(html.includes("#SF0130"));
  assert.ok(html.includes("62.000đ"));
  assert.ok(html.includes("09:20"));
  assert.ok(html.includes("Phạm Thị Mai"));
  assert.ok(html.includes("<strong>KTX B</strong> · Tòa B2, Phòng 205"));
  assert.ok(html.includes("1× Bún bò Huế · 1× Trà tắc · +1 món"));
  assert.ok(html.includes("Có ghi chú"));
  assert.ok(html.includes("Chuyển khoản"));

  // Action buttons order on mobile cards: Từ chối (left) before Chấp nhận (right)
  const rejectIdx = html.indexOf('class="mobileRejectButton">Từ chối</button>');
  const acceptIdx = html.indexOf('class="mobileAcceptButton">Chấp nhận</button>');
  assert.ok(rejectIdx !== -1 && acceptIdx !== -1);
  assert.ok(
    rejectIdx < acceptIdx,
    "Mobile order card must render 'Từ chối' on the left and 'Chấp nhận' on the right",
  );
  assert.ok(html.includes("Xem chi tiết"));

  // Bottom navigation badge "3" on Đơn hàng icon
  assert.ok(html.includes('data-testid="seller-orders-nav-badge"'));
  assert.ok(html.includes('aria-label="3 đơn chờ xác nhận"'));
  assert.ok(html.includes("Thực đơn"));
}

function run() {
  testViewportAndResponsiveOrderStyles();
  testMobileFixturesAndFilterSortLogic();
  testBottomNavigationPendingBadge();
  testSellerOrdersViewMarkup();
  console.log(
    "PASS: Seller Orders mobile UI, Desktop preservation, and bottom navigation pending badge verified (4 test suites).",
  );
}

run();
