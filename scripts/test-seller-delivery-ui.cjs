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

function testViewportAndResponsiveStyles() {
  for (const pageModule of [deliverDemoPage, deliveryDemoPage]) {
    assert.equal(pageModule.viewport.width, "device-width");
    assert.equal(pageModule.viewport.initialScale, 1);
    assert.equal(pageModule.viewport.viewportFit, "cover");
  }

  const deliveryCss = fs.readFileSync(
    path.join(projectRoot, "styles/delivery.module.css"),
    "utf8",
  );
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
  // Payment method QR visibility rule: only "transfer" ("Chuyển khoản") displays "Mã QR"
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

function testDeliveryDashboardMarkupAndPaymentRules() {
  const html = renderToStaticMarkup(React.createElement(DeliveryDashboard));

  // Header & Brand
  assert.ok(html.includes("Student<span>Food</span>"));
  assert.ok(html.includes("<small>Quyền giao hàng</small>"));
  assert.ok(html.includes("<span>Cơm Cô Ba</span>"));

  // Heading & Status Tabs
  assert.ok(html.includes("<h1>Đơn cần giao</h1>"));
  assert.ok(html.includes("<p>Xem các đơn đang chờ giao của cửa hàng.</p>"));
  assert.ok(html.includes("Cần giao (4)"));
  assert.ok(html.includes("Đã giao (12)"));

  // Dorm filter chips
  assert.ok(html.includes(">Tất cả</button>"));
  assert.ok(html.includes(">KTX A</button>"));
  assert.ok(html.includes(">KTX B</button>"));

  // Summary Banner + exact Scooter SVG
  assert.ok(html.includes("<span>Hôm nay</span>"));
  assert.ok(html.includes("<strong>4 đơn cần giao</strong>"));
  assert.ok(html.includes("<small>Cố gắng giao đúng giờ nhé!</small>"));
  assert.ok(html.includes("M14.8438 7.03125H17.1875"));
  assert.ok(html.includes("M12.7602 10.1562C13.4789"));

  // Split HTML by order cards to verify per-card QR button visibility & layout
  const card128Start = html.indexOf('data-testid="delivery-order-card-SF0128"');
  const card129Start = html.indexOf('data-testid="delivery-order-card-SF0129"');
  const card130Start = html.indexOf('data-testid="delivery-order-card-SF0130"');
  const card131Start = html.indexOf('data-testid="delivery-order-card-SF0131"');

  assert.ok(
    card128Start !== -1 &&
      card129Start !== -1 &&
      card130Start !== -1 &&
      card131Start !== -1,
    "All 4 delivering order cards must be rendered",
  );

  const card128Html = html.slice(card128Start, card129Start);
  const card129Html = html.slice(card129Start, card130Start);
  const card130Html = html.slice(card130Start, card131Start);
  const card131Html = html.slice(card131Start);

  // Card 1: #SF0128 (Tiền mặt -> NO "Mã QR" button)
  assert.ok(card128Html.includes("#SF0128"));
  assert.ok(card128Html.includes("Mới"));
  assert.ok(card128Html.includes("10:24"));
  assert.ok(card128Html.includes("Nguyễn Minh Anh"));
  assert.ok(card128Html.includes("0321 456 789"));
  assert.ok(card128Html.includes("KTX A"));
  assert.ok(card128Html.includes("Cổng B, Phòng 302"));
  assert.ok(card128Html.includes("2 món"));
  assert.ok(card128Html.includes("Tiền mặt"));
  assert.ok(card128Html.includes("56.000đ"));
  assert.ok(card128Html.includes("Cơm sườn nướng x1  •  Trà tắc x1"));
  assert.ok(card128Html.includes("Gọi khách"));
  assert.ok(card128Html.includes("Xem chi tiết"));
  assert.ok(card128Html.includes("Đánh dấu đã giao"));
  assert.ok(card128Html.includes('data-has-qr="false"'));
  assert.equal(
    card128Html.includes("Mã QR"),
    false,
    "Cash order #SF0128 must NOT display 'Mã QR' button",
  );

  // Card 2: #SF0129 (Chuyển khoản -> MUST display "Mã QR" button)
  assert.ok(card129Html.includes("#SF0129"));
  assert.ok(card129Html.includes("Mới"));
  assert.ok(card129Html.includes("11:05"));
  assert.ok(card129Html.includes("Trần Thị Bảo Ngọc"));
  assert.ok(card129Html.includes("0909 876 543"));
  assert.ok(card129Html.includes("KTX B"));
  assert.ok(card129Html.includes("Tòa B1, Phòng 101"));
  assert.ok(card129Html.includes("3 món"));
  assert.ok(card129Html.includes("Chuyển khoản"));
  assert.ok(card129Html.includes("72.000đ"));
  assert.ok(
    card129Html.includes(
      "Cơm gà xối mỡ x1  •  Canh rong biển x1  •  Trà sữa truyền thống x1",
    ),
  );
  assert.ok(card129Html.includes("Gọi khách"));
  assert.ok(card129Html.includes("Xem chi tiết"));
  assert.ok(card129Html.includes('data-has-qr="true"'));
  assert.equal(
    card129Html.includes("Mã QR"),
    true,
    "Transfer order #SF0129 MUST display 'Mã QR' button",
  );
  assert.ok(card129Html.includes("Đánh dấu đã giao"));
  // Verify button ordering inside #SF0129: Gọi khách -> Xem chi tiết -> Mã QR -> Đánh dấu đã giao
  const idxCall = card129Html.indexOf("Gọi khách");
  const idxDetail = card129Html.indexOf("Xem chi tiết");
  const idxQr = card129Html.indexOf("Mã QR");
  const idxComplete = card129Html.indexOf("Đánh dấu đã giao");
  assert.ok(
    idxCall < idxDetail && idxDetail < idxQr && idxQr < idxComplete,
    "Order #SF0129 buttons must appear in exact mockup order: Gọi khách -> Xem chi tiết -> Mã QR -> Đánh dấu đã giao",
  );

  // Card 3: #SF0130 (Tiền mặt -> NO "Mã QR" button)
  assert.ok(card130Html.includes("#SF0130"));
  assert.ok(card130Html.includes("Đang chờ"));
  assert.ok(card130Html.includes("11:32"));
  assert.ok(card130Html.includes("Lê Hoàng Nam"));
  assert.ok(card130Html.includes("0789 321 654"));
  assert.ok(card130Html.includes("KTX A"));
  assert.ok(card130Html.includes("Tòa A2, Phòng 205"));
  assert.ok(card130Html.includes("2 món"));
  assert.ok(card130Html.includes("Tiền mặt"));
  assert.ok(card130Html.includes("48.000đ"));
  assert.ok(card130Html.includes("Bánh tráng trộn x1  •  Trà đào x1"));
  assert.ok(card130Html.includes("Gọi khách"));
  assert.ok(card130Html.includes("Xem chi tiết"));
  assert.ok(card130Html.includes("Đánh dấu đã giao"));
  assert.ok(card130Html.includes('data-has-qr="false"'));
  assert.equal(
    card130Html.includes("Mã QR"),
    false,
    "Cash order #SF0130 must NOT display 'Mã QR' button",
  );

  // Card 4: #SF0131 (Tiền mặt -> NO "Mã QR" button)
  assert.ok(card131Html.includes('data-has-qr="false"'));
  assert.equal(
    card131Html.includes("Mã QR"),
    false,
    "Cash order #SF0131 must NOT display 'Mã QR' button",
  );
}

function run() {
  testViewportAndResponsiveStyles();
  testScooterSvgExactMatch();
  testDeliveryHelpersAndQrButtonLogic();
  testDeliveryDashboardMarkupAndPaymentRules();
  console.log(
    "PASS: Seller 'Đơn cần giao' (/deliver/demo & /delivery/demo) mobile UI, exact Scooter SVG, conditional 'Mã QR' button for bank transfer vs cash, and responsive styles verified (4 test suites).",
  );
}

run();
