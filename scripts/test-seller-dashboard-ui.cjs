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
      usePathname: () => "/seller",
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
const navIcons = require(
  path.join(projectRoot, "components/ui/SellerBottomNavIcons.tsx"),
);
const {
  default: SellerBottomNavigation,
  sellerNavDestinations,
  isSellerNavActive,
} = require(
  path.join(projectRoot, "components/features/seller/SellerBottomNavigation.tsx"),
);
const { default: SellerSidebar } = require(
  path.join(projectRoot, "components/features/seller/SellerSidebar.tsx"),
);
const {
  default: SellerOverviewView,
  sellerMobileChecklistItems,
  sellerMobileDateOptions,
  sellerMobileTodayStats,
} = require(
  path.join(projectRoot, "components/features/seller/SellerOverviewView.tsx"),
);
const {
  useSellerPreviewStore,
} = require(path.join(projectRoot, "store/useSellerPreviewStore.ts"));

function testViewportAndResponsiveStyles() {
  assert.equal(sellerLayout.viewport.width, "device-width");
  assert.equal(sellerLayout.viewport.initialScale, 1);
  assert.equal(sellerLayout.viewport.viewportFit, "cover");

  const mobileNavCss = fs.readFileSync(
    path.join(projectRoot, "styles/seller-mobile-navigation.module.css"),
    "utf8",
  );
  assert.match(mobileNavCss, /env\(safe-area-inset-bottom/);
  assert.match(mobileNavCss, /@media \(max-width: 760px\)/);
  assert.match(mobileNavCss, /@media \(max-width: 440px\)/);
  assert.match(mobileNavCss, /@media \(max-width: 393px\)/);
  assert.match(mobileNavCss, /@media \(max-width: 360px\)/);

  const overviewCss = fs.readFileSync(
    path.join(projectRoot, "styles/seller-overview.module.css"),
    "utf8",
  );
  assert.match(overviewCss, /\.desktopView\s*\{\s*display:\s*block;\s*\}/);
  assert.match(overviewCss, /\.mobileView\s*\{\s*display:\s*none;\s*\}/);
  assert.match(overviewCss, /env\(safe-area-inset-bottom/);
  assert.match(overviewCss, /@media \(max-width: 760px\)/);
  assert.match(overviewCss, /@media \(max-width: 440px\)/);
  assert.match(overviewCss, /@media \(max-width: 393px\)/);
  assert.match(overviewCss, /@media \(max-width: 360px\)/);
}

function testSellerBottomNavSvgIcons() {
  const iconEntries = [
    ["SellerHomeInactiveIcon", navIcons.SellerHomeInactiveIcon, "M10.9896 2.63754"],
    ["SellerOrderInactiveIcon", navIcons.SellerOrderInactiveIcon, "M17.3998 3.66016"],
    ["SellerMenuInactiveIcon", navIcons.SellerMenuInactiveIcon, 'fill="white"'],
    ["SellerStoreInactiveIcon", navIcons.SellerStoreInactiveIcon, "M19.982 8.251"],
    ["SellerHomeActiveIcon", navIcons.SellerHomeActiveIcon, "M10.9896 2.63754"],
    ["SellerOrderActiveIcon", navIcons.SellerOrderActiveIcon, 'stroke="white"'],
    ["SellerMenuActiveIcon", navIcons.SellerMenuActiveIcon, "M19.5008 0.750005"],
    ["SellerStoreActiveIcon", navIcons.SellerStoreActiveIcon, "M21.998 8"],
  ];

  for (const [name, IconComponent, expectedSnippet] of iconEntries) {
    assert.equal(typeof IconComponent, "function", `${name} must be a component`);
    const svgHtml = renderToStaticMarkup(React.createElement(IconComponent));
    assert.ok(svgHtml.startsWith("<svg"), `${name} must render an <svg> element`);
    assert.ok(svgHtml.includes('viewBox="0 0 25 25"'), `${name} must use 25x25 viewBox`);
    assert.ok(svgHtml.includes("#F24822"), `${name} must use brand color #F24822`);
    assert.ok(
      svgHtml.includes(expectedSnippet),
      `${name} must contain exact SVG fragment: ${expectedSnippet}`,
    );
  }

  // Inactive vs Active distinctness checks
  const homeInactive = renderToStaticMarkup(
    React.createElement(navIcons.SellerHomeInactiveIcon),
  );
  const homeActive = renderToStaticMarkup(
    React.createElement(navIcons.SellerHomeActiveIcon),
  );
  assert.notEqual(
    homeInactive,
    homeActive,
    "Homepage inactive and active SVG icons must be distinct",
  );

  const orderInactive = renderToStaticMarkup(
    React.createElement(navIcons.SellerOrderInactiveIcon),
  );
  const orderActive = renderToStaticMarkup(
    React.createElement(navIcons.SellerOrderActiveIcon),
  );
  assert.notEqual(
    orderInactive,
    orderActive,
    "Order inactive and active SVG icons must be distinct",
  );

  const menuInactive = renderToStaticMarkup(
    React.createElement(navIcons.SellerMenuInactiveIcon),
  );
  const menuActive = renderToStaticMarkup(
    React.createElement(navIcons.SellerMenuActiveIcon),
  );
  assert.notEqual(
    menuInactive,
    menuActive,
    "Menu inactive and active SVG icons must be distinct",
  );

  const storeInactive = renderToStaticMarkup(
    React.createElement(navIcons.SellerStoreInactiveIcon),
  );
  const storeActive = renderToStaticMarkup(
    React.createElement(navIcons.SellerStoreActiveIcon),
  );
  assert.notEqual(
    storeInactive,
    storeActive,
    "Store inactive and active SVG icons must be distinct",
  );
}

function testSellerBottomNavigationAndSidebar() {
  assert.equal(sellerNavDestinations.length, 4);
  assert.deepEqual(
    sellerNavDestinations.map((item) => [item.key, item.label, item.href]),
    [
      ["overview", "Tổng quan", "/seller"],
      ["orders", "Đơn hàng", "/seller/orders"],
      ["menu", "Menu", "/seller/menu"],
      ["shop", "Cửa hàng", "/seller/shop"],
    ],
  );

  assert.equal(isSellerNavActive("/seller", "/seller", "overview", "overview"), true);
  assert.equal(isSellerNavActive("/seller", "/seller/orders", "overview", "orders"), false);
  assert.equal(isSellerNavActive("/seller/payments", "/seller/shop", "payments", "shop"), false);
  assert.equal(isSellerNavActive("/seller/menu/new", "/seller/menu"), true);

  const overviewNavHtml = renderToStaticMarkup(
    React.createElement(SellerBottomNavigation, { active: "overview" }),
  );
  assert.ok(
    overviewNavHtml.includes(
      'aria-label="Điều hướng quản lý cửa hàng trên điện thoại"',
    ),
  );
  assert.ok(overviewNavHtml.includes('href="/seller"'));
  assert.ok(overviewNavHtml.includes('href="/seller/orders"'));
  assert.ok(overviewNavHtml.includes('href="/seller/menu"'));
  assert.ok(overviewNavHtml.includes('href="/seller/shop"'));
  assert.ok(overviewNavHtml.includes('aria-current="page"'));
  assert.ok(overviewNavHtml.includes("Tổng quan"));
  assert.ok(overviewNavHtml.includes("Đơn hàng"));
  assert.ok(overviewNavHtml.includes("Menu"));
  assert.ok(overviewNavHtml.includes("Cửa hàng"));

  // Sidebar integration ensures all Seller screens receive the unified icons & bottom nav
  const sidebarHtml = renderToStaticMarkup(
    React.createElement(SellerSidebar, { active: "orders", name: "Cơm Cô Ba" }),
  );
  assert.ok(sidebarHtml.includes('aria-label="Quản lý cửa hàng"'));
  assert.ok(
    sidebarHtml.includes(
      'aria-label="Điều hướng quản lý cửa hàng trên điện thoại"',
    ),
  );
}

function testSellerOverviewDashboardMarkup() {
  useSellerPreviewStore.setState({ draft: null });

  assert.equal(sellerMobileChecklistItems.length, 4);
  assert.equal(sellerMobileTodayStats.length, 4);
  assert.equal(sellerMobileDateOptions[0], "Hôm nay, 10/09/2026");

  const html = renderToStaticMarkup(React.createElement(SellerOverviewView));

  // Both Desktop & Mobile containers exist so Desktop UI is preserved while Mobile matches mockup
  assert.ok(html.includes('class="desktopView"'), "Desktop view container must be preserved");
  assert.ok(html.includes('class="mobileView"'), "Mobile view container must be rendered");

  // Header & Greeting
  assert.ok(html.includes("Student<span>Food</span>"));
  assert.ok(html.includes("Món ngon, gần bạn hơn"));
  assert.ok(html.includes("Seller Dashboard"));
  assert.ok(html.includes("Xin chào,"));
  assert.ok(html.includes("Cơm Cô Ba"));
  assert.ok(
    html.includes(
      "Cùng hoàn thiện cửa hàng để bắt đầu phục vụ các bạn sinh viên nhé!",
    ),
  );

  // Success Alert Banner
  assert.ok(html.includes("Tạo cửa hàng thành công!"));
  assert.ok(
    html.includes(
      "Cửa hàng của bạn đã được tạo trên StudentFood. Hãy hoàn thiện các thông tin dưới đây trước khi mở nhận đơn.",
    ),
  );

  // Store Status Card
  assert.ok(html.includes("Trạng thái cửa hàng"));
  assert.ok(html.includes("Tạm đóng"));
  assert.ok(
    html.includes("Cửa hàng của bạn đang tạm đóng và chưa nhận đơn hàng."),
  );
  assert.ok(html.includes("Mở nhận đơn"));
  assert.ok(
    html.includes(
      "Bạn cần thêm ít nhất 1 món đang bán trước khi mở cửa hàng.",
    ),
  );

  // Complete Store Checklist Card
  assert.ok(html.includes("Hoàn thiện cửa hàng"));
  assert.ok(html.includes("0/4 hoàn thành"));
  assert.ok(
    html.includes(
      "Hoàn thiện các thông tin quan trọng để bắt đầu kinh doanh.",
    ),
  );
  assert.ok(html.includes("Thêm món đầu tiên"));
  assert.ok(html.includes("Tạo và đăng món ăn đầu tiên"));
  assert.ok(html.includes("Tải ảnh đại diện"));
  assert.ok(html.includes("Giúp cửa hàng của bạn nổi bật hơn"));
  assert.ok(html.includes("Cấu hình chuyển khoản"));
  assert.ok(html.includes("Nhận thanh toán qua ngân hàng"));
  assert.ok(html.includes("Sau khi hoàn tất các bước trên"));

  // Today Overview Section
  assert.ok(html.includes("Tổng quan hôm nay"));
  assert.ok(html.includes("Hôm nay, 10/09/2026"));
  assert.ok(html.includes("Đơn mới"));
  assert.ok(html.includes("Đã chấp nhận"));
  assert.ok(html.includes("Hoàn thành"));
  assert.ok(html.includes("Doanh thu"));
  assert.ok(html.includes("0đ"));
  assert.ok(html.includes("đơn hàng"));
  assert.ok(html.includes("hôm nay"));

  // New Orders Section
  assert.ok(html.includes("Đơn hàng mới"));
  assert.ok(html.includes("Xem tất cả"));
  assert.ok(html.includes("Chưa có đơn hàng nào"));
  assert.ok(
    html.includes(
      "Khi cửa hàng bắt đầu nhận đơn, các đơn hàng mới sẽ hiển thị tại đây.",
    ),
  );

  // Dynamic draft store name check
  const sampleDraft = {
    name: "Bếp Cô Tư",
    location: "KTX Khu B",
    description: "Cơm sinh viên",
    hours: "07:00 - 21:00",
    cash: true,
    bank: false,
  };
  useSellerPreviewStore.getState().registerPreview(sampleDraft);
  useSellerPreviewStore.getInitialState().draft = sampleDraft;

  const htmlWithDraft = renderToStaticMarkup(
    React.createElement(SellerOverviewView),
  );
  assert.ok(
    htmlWithDraft.includes("Bếp Cô Tư"),
    "Seller Dashboard must reflect dynamic store name from seller preview draft",
  );
  useSellerPreviewStore.setState({ draft: null });
  useSellerPreviewStore.getInitialState().draft = null;
}

function run() {
  testViewportAndResponsiveStyles();
  testSellerBottomNavSvgIcons();
  testSellerBottomNavigationAndSidebar();
  testSellerOverviewDashboardMarkup();
  console.log(
    "PASS: Seller Dashboard mobile UI, Desktop preservation, and unified Seller Navigation SVG icons verified (4 test suites).",
  );
}

run();
