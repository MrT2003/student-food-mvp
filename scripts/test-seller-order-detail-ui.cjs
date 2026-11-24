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
      ...props
    }) {
      void _unoptimized;
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
      usePathname: () => "/seller/orders/SF0128",
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
  default: SellerOrderDetailView,
  SELLER_ORDER_DETAIL_DEFAULT_CODE,
  SELLER_ORDER_DETAIL_REFERENCE_DATE,
  SELLER_ORDER_DETAIL_CAMPUS_SUBTITLE,
  createDefaultSellerOrderDetailFixture,
  formatSellerOrderDetailPlacedAt,
  formatSellerOrderDetailItemOptions,
  formatSellerOrderDetailAddress,
  getSellerOrderDetailItemImage,
  getSellerOrderDetailPaymentMethodLabel,
  getSellerOrderDetailPaymentStatusLabel,
  resolveSellerOrderForDetail,
} = require(
  path.join(projectRoot, "components/features/seller/SellerOrderDetailView.tsx"),
);
const {
  default: SellerOrdersView,
  createSellerMobileOrderFixtures,
} = require(
  path.join(projectRoot, "components/features/seller/SellerOrdersView.tsx"),
);
const {
  transitionSellerOrder,
} = require(path.join(projectRoot, "lib/seller/orders.ts"));
const {
  useSellerPreviewStore,
} = require(path.join(projectRoot, "store/useSellerPreviewStore.ts"));

function testViewportAndResponsiveStyles() {
  assert.equal(sellerLayout.viewport.width, "device-width");
  assert.equal(sellerLayout.viewport.initialScale, 1);
  assert.equal(sellerLayout.viewport.viewportFit, "cover");

  const detailCss = fs.readFileSync(
    path.join(projectRoot, "styles/seller-order-detail.module.css"),
    "utf8",
  );
  assert.match(detailCss, /env\(safe-area-inset-top/);
  assert.match(detailCss, /env\(safe-area-inset-bottom/);
  assert.match(detailCss, /\.bottomActionBar\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(detailCss, /\.bottomActionBar\s*\{[\s\S]*?z-index:\s*90/);
  assert.match(detailCss, /@media \(max-width: 440px\)/);
  assert.match(detailCss, /@media \(max-width: 393px\)/);
  assert.match(detailCss, /@media \(max-width: 360px\)/);

  const ordersCss = fs.readFileSync(
    path.join(projectRoot, "styles/seller-orders.module.css"),
    "utf8",
  );
  assert.match(
    ordersCss,
    /\.page\[data-mobile-detail-open="true"\]\s*>\s*header/,
  );
  assert.match(
    ordersCss,
    /\.page\[data-mobile-detail-open="true"\]\s*\.workspace\s*>\s*nav/,
  );

  // Verify dish image assets exist in public/
  assert.equal(
    fs.existsSync(path.join(projectRoot, "public/seller-order-tra-sua.png")),
    true,
    "Trà sữa truyền thống thumbnail must exist in public/",
  );
  assert.equal(
    fs.existsSync(
      path.join(projectRoot, "public/seller-order-banh-trang-tron.png"),
    ),
    true,
    "Bánh tráng trộn thumbnail must exist in public/",
  );
}

function testSellerOrderDetailDataAndHelpers() {
  const order = createDefaultSellerOrderDetailFixture();

  assert.equal(order.order_code, SELLER_ORDER_DETAIL_DEFAULT_CODE);
  assert.equal(order.order_status, "pending");
  assert.equal(order.subtotal, 45000);
  assert.equal(order.total, 45000);
  assert.equal(
    formatSellerOrderDetailPlacedAt(order.created_at),
    `Đặt lúc 10:24 · ${SELLER_ORDER_DETAIL_REFERENCE_DATE}`,
  );

  assert.equal(order.order_items.length, 2);
  assert.equal(order.order_items[0].item_name_snapshot, "Trà sữa truyền thống");
  assert.equal(order.order_items[0].unit_price_snapshot, 25000);
  assert.equal(order.order_items[0].quantity, 1);
  assert.equal(
    formatSellerOrderDetailItemOptions(order.order_items[0]),
    "Trân châu đen · Ít đá",
  );
  assert.equal(
    getSellerOrderDetailItemImage(order.order_items[0]),
    "/seller-order-tra-sua.png",
  );

  assert.equal(order.order_items[1].item_name_snapshot, "Bánh tráng trộn");
  assert.equal(order.order_items[1].unit_price_snapshot, 20000);
  assert.equal(order.order_items[1].quantity, 1);
  assert.equal(
    formatSellerOrderDetailItemOptions(order.order_items[1]),
    "Thêm trứng cút",
  );
  assert.equal(
    getSellerOrderDetailItemImage(order.order_items[1]),
    "/seller-order-banh-trang-tron.png",
  );

  assert.equal(order.customer_notes, "Gọi trước khi giao nhé!");
  assert.equal(order.customer.name, "Trần Minh Anh");
  assert.equal(order.customer.phone, "0901 234 567");

  assert.deepEqual(formatSellerOrderDetailAddress(order.delivery_address), {
    primary: "KTX A · Cổng B, Phòng 302",
    secondary: SELLER_ORDER_DETAIL_CAMPUS_SUBTITLE,
  });

  assert.equal(
    getSellerOrderDetailPaymentMethodLabel(order.payment_method),
    "Tiền mặt khi nhận món",
  );
  assert.equal(getSellerOrderDetailPaymentStatusLabel(order), "Chưa thanh toán");

  // Resolve by order code (#SF0128 or SF0128) or UUID
  const fixtures = createSellerMobileOrderFixtures();
  assert.equal(
    resolveSellerOrderForDetail({ orderId: "#SF0128", orders: fixtures })
      .order_code,
    "SF0128",
  );
  assert.equal(
    resolveSellerOrderForDetail({ orderId: "SF0129", orders: fixtures })
      .order_code,
    "SF0129",
  );
}

function testSellerOrderDetailMarkupMatchesMockup() {
  const html = renderToStaticMarkup(React.createElement(SellerOrderDetailView));

  // 1. Navigation Bars hidden; replaced by Top Header Bar and Sticky Bottom Action Bar
  assert.ok(html.includes('data-testid="seller-order-detail-screen"'));
  assert.ok(html.includes('data-navigation-hidden="true"'));
  assert.equal(
    html.includes('aria-label="Điều hướng quản lý cửa hàng trên điện thoại"'),
    false,
    "Bottom navigation bar must be hidden/excluded on Chi tiết đơn hàng screen",
  );
  assert.equal(
    html.includes("Student<span>Food</span>"),
    false,
    "Main top header must be hidden/excluded on Chi tiết đơn hàng screen",
  );

  // 2. Top Header Bar
  assert.ok(html.includes('aria-label="Quay lại danh sách đơn hàng"'));
  assert.ok(html.includes("Chi tiết đơn hàng"));

  // 3. Order Code, Timestamp & Status Badge
  assert.ok(html.includes("#SF0128"));
  assert.ok(html.includes("Chờ xác nhận"));
  assert.ok(html.includes("Đặt lúc 10:24 · 10/09/2026"));

  // 4. Card 1: Món đã đặt (2 món)
  assert.ok(html.includes("Món đã đặt"));
  assert.ok(html.includes("2 món"));
  assert.ok(html.includes("Trà sữa truyền thống"));
  assert.ok(html.includes("Trân châu đen · Ít đá"));
  assert.ok(html.includes("25.000đ"));
  assert.ok(html.includes('src="/seller-order-tra-sua.png"'));

  assert.ok(html.includes("Bánh tráng trộn"));
  assert.ok(html.includes("Thêm trứng cút"));
  assert.ok(html.includes("20.000đ"));
  assert.ok(html.includes('src="/seller-order-banh-trang-tron.png"'));
  assert.ok(html.includes("×1"));

  assert.ok(html.includes("Ghi chú của khách"));
  assert.ok(html.includes("Gọi trước khi giao nhé!"));

  // 5. Card 2: Khách hàng & nhận hàng
  assert.ok(html.includes("Khách hàng &amp; nhận hàng"));
  assert.ok(html.includes("Trần Minh Anh"));
  assert.ok(html.includes("0901 234 567"));
  assert.ok(html.includes('href="tel:0901234567"'));
  assert.ok(html.includes("Gọi khách"));
  assert.ok(html.includes("KTX A · Cổng B, Phòng 302"));
  assert.ok(html.includes("Khu nội trú ĐH Bách Khoa"));

  // 6. Card 3: Thanh toán
  assert.ok(html.includes("Thanh toán"));
  assert.ok(html.includes("Chưa thanh toán"));
  assert.ok(html.includes("Phương thức"));
  assert.ok(html.includes("Tiền mặt khi nhận món"));
  assert.ok(html.includes("Tạm tính"));
  assert.ok(html.includes("Phí giao hàng"));
  assert.ok(html.includes("0đ"));
  assert.ok(html.includes("Tổng cộng"));
  assert.ok(html.includes("45.000đ"));

  // 7. Bottom Action Bar: Từ chối (left) before Chấp nhận đơn (right)
  assert.ok(html.includes('data-testid="seller-order-detail-actions"'));
  const rejectIdx = html.indexOf(">Từ chối</button>");
  const acceptIdx = html.indexOf(">Chấp nhận đơn</button>");
  assert.ok(rejectIdx !== -1 && acceptIdx !== -1);
  assert.ok(
    rejectIdx < acceptIdx,
    "Bottom action bar must render 'Từ chối' on the left and 'Chấp nhận đơn' on the right",
  );
}

function testStatusTransitionsAndDesktopPreservation() {
  const pendingOrder = createDefaultSellerOrderDetailFixture();
  const acceptedOrder = transitionSellerOrder(
    pendingOrder,
    "accepted",
    "2026-10-05T03:30:00.000Z",
  );
  const acceptedHtml = renderToStaticMarkup(
    React.createElement(SellerOrderDetailView, { order: acceptedOrder }),
  );
  assert.ok(acceptedHtml.includes("Đã chấp nhận"));
  assert.ok(acceptedHtml.includes("Hoàn thành đơn"));

  const completedOrder = transitionSellerOrder(
    acceptedOrder,
    "completed",
    "2026-10-05T03:45:00.000Z",
  );
  const completedHtml = renderToStaticMarkup(
    React.createElement(SellerOrderDetailView, { order: completedOrder }),
  );
  assert.ok(completedHtml.includes("Đã thanh toán"));
  assert.equal(
    completedHtml.includes('data-testid="seller-order-detail-actions"'),
    false,
  );

  // Desktop preservation in SellerOrdersView
  useSellerPreviewStore.setState({ draft: null });
  useSellerPreviewStore.getInitialState().draft = null;
  const ordersHtml = renderToStaticMarkup(React.createElement(SellerOrdersView));
  assert.ok(
    ordersHtml.includes('class="desktopView"'),
    "Desktop Seller Orders view must remain 100% intact",
  );
  assert.ok(ordersHtml.includes('data-mobile-detail-open="false"'));
}

function run() {
  testViewportAndResponsiveStyles();
  testSellerOrderDetailDataAndHelpers();
  testSellerOrderDetailMarkupMatchesMockup();
  testStatusTransitionsAndDesktopPreservation();
  console.log(
    "PASS: Seller Order Detail mobile UI (#SF0128), navigation bar replacement, responsive styles, and Desktop preservation verified (4 test suites).",
  );
}

run();
