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
  if (request === "server-only") {
    return {};
  }

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
      usePathname: () => "/deliver/demo",
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

const deliverDemoPage = require(
  path.join(projectRoot, "app/deliver/demo/page.tsx"),
);
const deliveryDemoPage = require(
  path.join(projectRoot, "app/delivery/demo/page.tsx"),
);
const {
  default: DeliveryDashboard,
  DeliveryScooterIcon,
  deliveryDormFilterOptions,
  initialMockDeliveryOrders,
  shouldShowDeliveryQrButton,
  getDeliveryOrderCounts,
  filterDeliveryOrders,
  getDeliveryBadgeLabel,
} = require(
  path.join(
    projectRoot,
    "components/features/delivery/DeliveryDashboard.tsx",
  ),
);

function testViewportDesktopMobileSeparationAndButtonDimensions() {
  for (const pageModule of [deliverDemoPage, deliveryDemoPage]) {
    assert.equal(pageModule.viewport.width, "device-width");
    assert.equal(pageModule.viewport.initialScale, 1);
    assert.equal(pageModule.viewport.viewportFit, "cover");
  }

  const deliveryCss = fs.readFileSync(
    path.join(projectRoot, "styles/delivery.module.css"),
    "utf8",
  );

  // Desktop vs Mobile toggling rules: Desktop active by default, Mobile only enabled at <= 760px
  assert.match(deliveryCss, /\.desktopView\s*\{\s*display:\s*block;\s*\}/);
  assert.match(deliveryCss, /\.mobileView\s*\{\s*display:\s*none;\s*\}/);
  assert.match(
    deliveryCss,
    /@media \(max-width: 760px\)[\s\S]*?\.desktopView\s*\{\s*display:\s*none;\s*\}[\s\S]*?\.mobileView\s*\{\s*display:\s*block;\s*\}/,
  );

  // Equal button dimensions rule for Gọi khách, Xem chi tiết, Mã QR, Đánh dấu đã giao
  assert.match(
    deliveryCss,
    /\.actionsGrid,\s*\.secondaryActionsGrid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(
    deliveryCss,
    /\.callBtn,\s*\.detailBtn,\s*\.qrBtn,\s*\.completeBtn\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?height:\s*38px;[\s\S]*?min-height:\s*38px;[\s\S]*?max-height:\s*38px;[\s\S]*?white-space:\s*nowrap;/,
  );

  // Responsive mobile breakpoints (iPhone 14 Pro / 15 / 16 <= 393px, iPhone 16 Pro Max <= 440px, iPhone SE <= 360px)
  assert.match(deliveryCss, /env\(safe-area-inset-top/);
  assert.match(deliveryCss, /env\(safe-area-inset-bottom/);
  assert.match(deliveryCss, /@media \(max-width: 760px\)/);
  assert.match(deliveryCss, /@media \(max-width: 440px\)/);
  assert.match(deliveryCss, /@media \(max-width: 393px\)/);
  assert.match(deliveryCss, /@media \(max-width: 360px\)/);
}

function testScooterSvgExactMatch() {
  const scooterHtml = renderToStaticMarkup(
    React.createElement(DeliveryScooterIcon),
  );
  assert.ok(scooterHtml.startsWith("<svg"));
  assert.ok(scooterHtml.includes('width="25"'));
  assert.ok(scooterHtml.includes('height="25"'));
  assert.ok(scooterHtml.includes('viewBox="0 0 25 25"'));
  assert.ok(scooterHtml.includes('fill="#F24822"'));
  assert.ok(
    scooterHtml.includes("M14.8438 7.03125H17.1875C17.6019 7.03125"),
    "Scooter SVG must contain exact first path",
  );
  assert.ok(
    scooterHtml.includes("M12.7602 10.1562C13.4789 10.1562 14.0625 10.7391"),
    "Scooter SVG must contain exact second path",
  );
}

function testDeliveryHelpersAndQrButtonLogic() {
  assert.equal(shouldShowDeliveryQrButton("transfer"), true);
  assert.equal(shouldShowDeliveryQrButton("cash"), false);
  assert.equal(shouldShowDeliveryQrButton({ paymentMethod: "transfer" }), true);
  assert.equal(shouldShowDeliveryQrButton({ paymentMethod: "cash" }), false);

  const counts = getDeliveryOrderCounts(initialMockDeliveryOrders, 10);
  assert.deepEqual(counts, {
    deliveringCount: 4,
    deliveredCount: 12,
  });

  assert.deepEqual(
    deliveryDormFilterOptions.map((item) => [item.value, item.label]),
    [
      ["all", "Tất cả"],
      ["KTX A", "KTX A"],
      ["KTX B", "KTX B"],
    ],
  );

  const deliveringAll = filterDeliveryOrders(initialMockDeliveryOrders, {
    status: "delivering",
    dorm: "all",
  });
  assert.deepEqual(
    deliveringAll.map((o) => o.orderCode),
    ["#SF0128", "#SF0129", "#SF0130", "#SF0131"],
  );

  const deliveringKtxA = filterDeliveryOrders(initialMockDeliveryOrders, {
    status: "delivering",
    dorm: "KTX A",
  });
  assert.deepEqual(
    deliveringKtxA.map((o) => o.orderCode),
    ["#SF0128", "#SF0130"],
  );

  const deliveringKtxB = filterDeliveryOrders(initialMockDeliveryOrders, {
    status: "delivering",
    dorm: "KTX B",
  });
  assert.deepEqual(
    deliveringKtxB.map((o) => o.orderCode),
    ["#SF0129", "#SF0131"],
  );

  assert.equal(getDeliveryBadgeLabel("new"), "Mới");
  assert.equal(getDeliveryBadgeLabel("waiting"), "Đang chờ");
  assert.equal(getDeliveryBadgeLabel("done"), "Đã giao");
}

function testDesktopAndMobileDeliveryDashboardMarkup() {
  const html = renderToStaticMarkup(React.createElement(DeliveryDashboard));

  // Verify both Desktop and Mobile containers exist
  const desktopStart = html.indexOf('data-testid="seller-delivery-desktop"');
  const mobileStart = html.indexOf('data-testid="seller-delivery-mobile"');
  assert.ok(desktopStart !== -1, "Desktop view container must be rendered");
  assert.ok(mobileStart !== -1, "Mobile view container must be rendered");

  const desktopHtml = html.slice(desktopStart, mobileStart);
  const mobileHtml = html.slice(mobileStart);

  // 1. Desktop View assertions (following /seller and /seller/shop design rules)
  assert.ok(desktopHtml.includes('href="/seller"'));
  assert.ok(desktopHtml.includes('href="/seller/orders"'));
  assert.ok(desktopHtml.includes('href="/seller/menu"'));
  assert.ok(desktopHtml.includes('href="/seller/shop"'));
  assert.ok(desktopHtml.includes("Quay lại Cửa hàng"));
  assert.ok(desktopHtml.includes("Quản lý cửa hàng"));
  assert.ok(desktopHtml.includes("Hôm nay cần giao"));
  assert.ok(desktopHtml.includes("Đã giao hoàn tất"));
  assert.ok(desktopHtml.includes("Phân bổ khu vực"));
  assert.ok(desktopHtml.includes("Quy trình giao đơn"));
  assert.ok(
    desktopHtml.includes('data-testid="desktop-delivery-order-card-SF0129"'),
  );

  // 2. Mobile View assertions matching mockup 100%
  assert.ok(mobileHtml.includes("Student<span>Food</span>"));
  assert.ok(mobileHtml.includes("<small>Quyền giao hàng</small>"));
  assert.ok(mobileHtml.includes("<span>Cơm Cô Ba</span>"));
  assert.ok(mobileHtml.includes("<h1>Đơn cần giao</h1>"));
  assert.ok(
    mobileHtml.includes("<p>Xem các đơn đang chờ giao của cửa hàng.</p>"),
  );
  assert.ok(mobileHtml.includes("Cần giao (4)"));
  assert.ok(mobileHtml.includes("Đã giao (12)"));
  assert.ok(mobileHtml.includes(">Tất cả</button>"));
  assert.ok(mobileHtml.includes(">KTX A</button>"));
  assert.ok(mobileHtml.includes(">KTX B</button>"));

  // Split Mobile HTML by order cards
  const card128Start = mobileHtml.indexOf(
    'data-testid="delivery-order-card-SF0128"',
  );
  const card129Start = mobileHtml.indexOf(
    'data-testid="delivery-order-card-SF0129"',
  );
  const card130Start = mobileHtml.indexOf(
    'data-testid="delivery-order-card-SF0130"',
  );
  const card131Start = mobileHtml.indexOf(
    'data-testid="delivery-order-card-SF0131"',
  );

  assert.ok(
    card128Start !== -1 &&
      card129Start !== -1 &&
      card130Start !== -1 &&
      card131Start !== -1,
    "All 4 delivering order cards must be rendered in mobile view",
  );

  const card128Html = mobileHtml.slice(card128Start, card129Start);
  const card129Html = mobileHtml.slice(card129Start, card130Start);
  const card130Html = mobileHtml.slice(card130Start, card131Start);
  const card131Html = mobileHtml.slice(card131Start);

  // Card 1: #SF0128 (Tiền mặt -> NO "Mã QR" button)
  assert.ok(card128Html.includes("Nguyễn Minh Anh"));
  assert.ok(card128Html.includes("Tiền mặt"));
  assert.ok(card128Html.includes('data-has-qr="false"'));
  assert.equal(
    card128Html.includes("Mã QR"),
    false,
    "Cash order #SF0128 must NOT display 'Mã QR' button",
  );

  // Card 2: #SF0129 - Trần Thị Bảo Ngọc (Chuyển khoản -> MUST display "Mã QR" button in 2-col secondaryActionsGrid)
  assert.ok(card129Html.includes("#SF0129"));
  assert.ok(card129Html.includes("Trần Thị Bảo Ngọc"));
  assert.ok(card129Html.includes("Chuyển khoản"));
  assert.ok(card129Html.includes("72.000đ"));
  assert.ok(card129Html.includes('class="actionsGrid"'));
  assert.ok(card129Html.includes('class="secondaryActionsGrid"'));
  assert.ok(card129Html.includes('data-has-qr="true"'));
  assert.ok(card129Html.includes("<span>Gọi khách</span>"));
  assert.ok(card129Html.includes("<span>Xem chi tiết</span>"));
  assert.ok(card129Html.includes("<span>Mã QR</span>"));
  assert.ok(card129Html.includes("<span>Đánh dấu đã giao</span>"));

  const idxCall = card129Html.indexOf("Gọi khách");
  const idxDetail = card129Html.indexOf("Xem chi tiết");
  const idxQr = card129Html.indexOf("Mã QR");
  const idxComplete = card129Html.indexOf("Đánh dấu đã giao");
  assert.ok(
    idxCall < idxDetail && idxDetail < idxQr && idxQr < idxComplete,
    "Order #SF0129 (Trần Thị Bảo Ngọc) buttons must appear in exact order: Gọi khách -> Xem chi tiết -> Mã QR -> Đánh dấu đã giao",
  );

  // Card 3 & Card 4 (Tiền mặt -> NO "Mã QR" button)
  assert.ok(card130Html.includes('data-has-qr="false"'));
  assert.equal(card130Html.includes("Mã QR"), false);
  assert.ok(card131Html.includes('data-has-qr="false"'));
  assert.equal(card131Html.includes("Mã QR"), false);
}

function run() {
  testViewportDesktopMobileSeparationAndButtonDimensions();
  testScooterSvgExactMatch();
  testDeliveryHelpersAndQrButtonLogic();
  testDesktopAndMobileDeliveryDashboardMarkup();
  console.log(
    "PASS: Seller 'Đơn cần giao' Desktop & Mobile views, equal button dimensions for 'Chuyển khoản' orders (#SF0129 Trần Thị Bảo Ngọc), exact Scooter SVG, and responsive styles verified (4 test suites).",
  );
}

run();
