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
    return function MockNextImage({
      src,
      alt,
      unoptimized: _unoptimized,
      fill: _fill,
      ...props
    }) {
      void _unoptimized;
      void _fill;
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
      usePathname: () => "/seller/shop",
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
  location: { origin: "http://localhost:3000" },
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
  isSellerNavActive,
} = require(
  path.join(projectRoot, "components/features/seller/SellerBottomNavigation.tsx"),
);
const {
  default: SellerShopView,
  DEFAULT_SELLER_MOBILE_SHOP_IMAGE,
  sellerMobileShopSetupItems,
  createInitialSellerShopPreview,
  getSellerMobileShopAvatar,
  formatSellerMobileScheduleSummary,
  formatSellerMobilePaymentSummary,
} = require(
  path.join(projectRoot, "components/features/seller/SellerShopView.tsx"),
);
const {
  useSellerPreviewStore,
} = require(path.join(projectRoot, "store/useSellerPreviewStore.ts"));
const {
  useSellerShopStore,
} = require(path.join(projectRoot, "store/useSellerShopStore.ts"));
const {
  useSellerPaymentStore,
} = require(path.join(projectRoot, "store/useSellerPaymentStore.ts"));

function testViewportAndResponsiveShopStyles() {
  assert.equal(sellerLayout.viewport.width, "device-width");
  assert.equal(sellerLayout.viewport.initialScale, 1);
  assert.equal(sellerLayout.viewport.viewportFit, "cover");

  const shopCss = fs.readFileSync(
    path.join(projectRoot, "styles/seller-shop.module.css"),
    "utf8",
  );
  assert.match(shopCss, /\.desktopView\s*\{\s*display:\s*grid;/);
  assert.match(shopCss, /\.mobileView\s*\{\s*display:\s*none;\s*\}/);
  assert.match(shopCss, /env\(safe-area-inset-bottom/);
  assert.match(shopCss, /@media \(max-width: 760px\)/);
  assert.match(shopCss, /@media \(max-width: 440px\)/);
  assert.match(shopCss, /@media \(max-width: 393px\)/);
  assert.match(shopCss, /@media \(max-width: 360px\)/);

  const storeImageFile = path.join(projectRoot, "public/seller-shop-com-co-ba.png");
  assert.equal(
    fs.existsSync(storeImageFile),
    true,
    "Expected mobile shop avatar thumbnail to exist at public/seller-shop-com-co-ba.png",
  );
}

function testSellerMobileShopHelpers() {
  const initialShop = createInitialSellerShopPreview(null);
  assert.equal(initialShop.name, "Cơm Cô Ba");
  assert.equal(initialShop.location, "KTX A");
  assert.equal(initialShop.daysPreview.length, 7);

  assert.equal(
    getSellerMobileShopAvatar(null),
    DEFAULT_SELLER_MOBILE_SHOP_IMAGE,
  );
  assert.equal(
    getSellerMobileShopAvatar("https://example.com/custom-shop.png"),
    "https://example.com/custom-shop.png",
  );

  // Default schedule: T2 - T7 enabled 10:00 - 14:00, CN disabled
  const defaultScheduleSummary = formatSellerMobileScheduleSummary(
    initialShop.daysPreview,
  );
  assert.deepEqual(defaultScheduleSummary, {
    hoursLine: "T2 – T7 · 10:00 – 14:00",
    closedLine: "Chủ nhật nghỉ",
  });

  // All days disabled
  const closedAllSummary = formatSellerMobileScheduleSummary(
    initialShop.daysPreview.map((d) => ({ ...d, enabled: false })),
  );
  assert.deepEqual(closedAllSummary, {
    hoursLine: "Chưa thiết lập giờ mở cửa",
    closedLine: "Tất cả các ngày nghỉ",
  });

  // Payment summary helper
  assert.equal(
    formatSellerMobilePaymentSummary(null, null),
    "Tiền mặt · Đã thiết lập chuyển khoản",
  );
  assert.equal(
    formatSellerMobilePaymentSummary(
      {
        cashEnabledPreview: true,
        bankEnabledPreview: false,
        bank_name: "Vietcombank",
        account_no: "0901234567",
        account_name: "NGUYEN VAN A",
        branchPreview: "Chi nhánh Hà Nội",
      },
      null,
    ),
    "Tiền mặt · Chưa thiết lập chuyển khoản",
  );

  assert.deepEqual(
    sellerMobileShopSetupItems.map((item) => [item.id, item.title, item.href ?? null]),
    [
      ["store-info", "Thông tin cửa hàng", null],
      ["operating-hours", "Giờ hoạt động", null],
      ["payments", "Thanh toán", "/seller/payments"],
    ],
  );
}

function testBottomNavigationShopActiveState() {
  assert.equal(
    isSellerNavActive("/seller/shop", "/seller/shop", "shop", "shop"),
    true,
  );
  assert.equal(
    isSellerNavActive("/seller/shop", "/seller/menu", "shop", "menu"),
    false,
  );

  const navHtml = renderToStaticMarkup(
    React.createElement(SellerBottomNavigation, {
      active: "shop",
      menuLabel: "Thực đơn",
    }),
  );
  assert.ok(
    navHtml.includes('aria-label="Điều hướng quản lý cửa hàng trên điện thoại"'),
  );
  assert.ok(navHtml.includes('href="/seller"'));
  assert.ok(navHtml.includes('href="/seller/orders"'));
  assert.ok(navHtml.includes('href="/seller/menu"'));
  assert.ok(navHtml.includes('href="/seller/shop"'));
  assert.ok(navHtml.includes('aria-current="page"'));
  assert.ok(navHtml.includes("Tổng quan"));
  assert.ok(navHtml.includes("Đơn hàng"));
  assert.ok(navHtml.includes("Thực đơn"));
  assert.ok(navHtml.includes("Cửa hàng"));
}

function testSellerShopViewMarkupAndDesktopPreservation() {
  useSellerPreviewStore.setState({ draft: null });
  useSellerPreviewStore.getInitialState().draft = null;
  useSellerShopStore.setState({ shop: null });
  useSellerPaymentStore.setState({ saved: null });

  const html = renderToStaticMarkup(React.createElement(SellerShopView));

  // Both Desktop & Mobile containers must be rendered so Desktop UI is 100% preserved
  assert.ok(
    html.includes('class="desktopView"'),
    "Desktop Seller Shop view container must be preserved",
  );
  assert.ok(
    html.includes('class="mobileView"'),
    "Mobile Seller Shop view container must be rendered",
  );
  assert.ok(html.includes('data-testid="seller-shop-mobile"'));

  // Desktop-specific elements preserved intact
  assert.ok(
    html.includes(
      "Quản lý thông tin và trạng thái hoạt động của cửa hàng bạn.",
    ),
  );
  assert.ok(html.includes("Sao chép link quán"));
  assert.ok(html.includes("Trạng thái hoạt động"));
  assert.ok(html.includes("Quản lý nhân viên"));
  assert.ok(html.includes("QR tuyển nhân viên"));

  // Extract Mobile section for focused assertions
  const mobileSectionStart = html.indexOf('data-testid="seller-shop-mobile"');
  const mobileHtml = html.slice(mobileSectionStart);

  // Mobile Heading
  assert.ok(mobileHtml.includes("<h1>Cửa hàng</h1>"));
  assert.ok(
    mobileHtml.includes("<p>Quản lý thông tin và hoạt động của quán.</p>"),
  );

  // Card 1: Store Profile Summary Card
  assert.ok(mobileHtml.includes('src="/seller-shop-com-co-ba.png"'));
  assert.ok(mobileHtml.includes("<h2>Cơm Cô Ba</h2>"));
  assert.ok(mobileHtml.includes("KTX A"));
  assert.ok(
    mobileHtml.includes('aria-label="Chỉnh sửa thông tin cửa hàng"'),
  );
  assert.ok(mobileHtml.includes("<span>Xem trang quán</span>"));
  assert.ok(mobileHtml.includes("<span>Sao chép link</span>"));
  assert.ok(mobileHtml.includes('href="/restaurants/com-co-ba"'));

  // Card 2: Nhận đơn
  assert.ok(mobileHtml.includes(">Nhận đơn</h2>"));
  assert.ok(mobileHtml.includes("Đang nhận đơn"));
  assert.ok(
    mobileHtml.includes("Quán đang mở và có thể nhận đơn mới."),
  );
  assert.ok(mobileHtml.includes("<span>Tạm ngừng nhận đơn</span>"));
  assert.ok(
    mobileHtml.includes("Tạm ngừng không làm hủy các đơn đã nhận."),
  );

  // Card 3: Thiết lập cửa hàng
  assert.ok(mobileHtml.includes(">Thiết lập cửa hàng</h2>"));
  assert.ok(mobileHtml.includes("<strong>Thông tin cửa hàng</strong>"));
  assert.ok(
    mobileHtml.includes("<span>Tên, ảnh, mô tả và số điện thoại</span>"),
  );
  assert.ok(mobileHtml.includes("<strong>Giờ hoạt động</strong>"));
  assert.ok(mobileHtml.includes("<span>T2 – T7 · 10:00 – 14:00</span>"));
  assert.ok(mobileHtml.includes("<span>Chủ nhật nghỉ</span>"));
  assert.ok(mobileHtml.includes("<strong>Thanh toán</strong>"));
  assert.ok(
    mobileHtml.includes("<span>Tiền mặt · Đã thiết lập chuyển khoản</span>"),
  );
  assert.ok(mobileHtml.includes('href="/seller/payments"'));

  // Card 4: Quyền giao hàng
  assert.ok(mobileHtml.includes(">Quyền giao hàng</h2>"));
  assert.ok(mobileHtml.includes("Đã tạo liên kết"));
  assert.ok(
    mobileHtml.includes(
      "Chia sẻ liên kết để người giao hàng xem đơn cần giao.",
    ),
  );
  assert.ok(mobileHtml.includes("<span>Sao chép liên kết</span>"));
  assert.ok(mobileHtml.includes("<span>Quản lý</span>"));
  assert.ok(
    mobileHtml.includes("<span>Chỉ chia sẻ với người giao hàng tin cậy.</span>"),
  );

  // Verify section ordering matches mockup top-to-bottom 100%
  const idxProfile = mobileHtml.indexOf("<h2>Cơm Cô Ba</h2>");
  const idxReceive = mobileHtml.indexOf(">Nhận đơn</h2>");
  const idxSetup = mobileHtml.indexOf(">Thiết lập cửa hàng</h2>");
  const idxDelivery = mobileHtml.indexOf(">Quyền giao hàng</h2>");

  assert.ok(
    idxProfile !== -1 &&
      idxReceive !== -1 &&
      idxSetup !== -1 &&
      idxDelivery !== -1,
  );
  assert.ok(
    idxProfile < idxReceive &&
      idxReceive < idxSetup &&
      idxSetup < idxDelivery,
    "Mobile shop cards must appear in exact mockup order: Store Profile -> Nhận đơn -> Thiết lập cửa hàng -> Quyền giao hàng",
  );
}

function run() {
  testViewportAndResponsiveShopStyles();
  testSellerMobileShopHelpers();
  testBottomNavigationShopActiveState();
  testSellerShopViewMarkupAndDesktopPreservation();
  console.log(
    "PASS: Seller Shop (Cửa hàng) mobile UI, Desktop preservation, store profile card, order status, setup rows, delivery link card, and bottom navigation verified (4 test suites).",
  );
}

run();
