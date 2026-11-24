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
  DeliveryOrderDetailModal,
  DEFAULT_DELIVERY_ORDER_NOTE,
  initialMockDeliveryOrders,
  resolveDeliveryOrderForDetail,
  getDeliveryOrderDishItems,
  getDeliveryOrderDishImage,
  getDeliveryOrderDishUnitLabel,
  getDeliveryDetailStatusBadgeLabel,
  getDeliveryDetailActionButtonLabel,
  formatDeliveryDetailTimestamp,
} = require(
  path.join(
    projectRoot,
    "components/features/delivery/DeliveryDashboard.tsx",
  ),
);

function testViewportAssetsAndDesktopMobilePopupStyles() {
  for (const pageModule of [deliverDemoPage, deliveryDemoPage]) {
    assert.equal(pageModule.viewport.width, "device-width");
    assert.equal(pageModule.viewport.initialScale, 1);
    assert.equal(pageModule.viewport.viewportFit, "cover");
  }

  // Verify dish thumbnails exist in public/
  assert.equal(
    fs.existsSync(
      path.join(projectRoot, "public/delivery-order-com-suon-nuong.png"),
    ),
    true,
    "Cơm sườn nướng thumbnail must exist in public/",
  );
  assert.equal(
    fs.existsSync(path.join(projectRoot, "public/delivery-order-tra-tac.png")),
    true,
    "Trà tắc thumbnail must exist in public/",
  );

  const deliveryCss = fs.readFileSync(
    path.join(projectRoot, "styles/delivery.module.css"),
    "utf8",
  );

  // Desktop popup window dimensions (max-width: 520px, border-radius: 22px, padding: 22px 24px) & transition preserved
  assert.match(
    deliveryCss,
    /\.detailSheetCard\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*520px;[\s\S]*?border-radius:\s*22px;[\s\S]*?padding:\s*22px 24px;[\s\S]*?transition:\s*transform\s+0\.2s[\s\S]*?animation:\s*detailDesktopPopupIn/,
  );

  // Mobile bottom-sheet popup rules (<= 760px) and responsive device breakpoints
  assert.match(
    deliveryCss,
    /@media \(max-width: 760px\)[\s\S]*?\.detailSheetCard\s*\{[\s\S]*?max-width:\s*480px;[\s\S]*?border-radius:\s*26px 26px 0 0;/,
  );
  assert.match(deliveryCss, /env\(safe-area-inset-bottom/);
  assert.match(deliveryCss, /@media \(max-width: 440px\)/);
  assert.match(deliveryCss, /@media \(max-width: 393px\)/);
  assert.match(deliveryCss, /@media \(max-width: 360px\)/);
}

function testDeliveryDetailHelpersAndButtonLabelStateLogic() {
  // Button label requirement:
  // "Đánh dấu đã giao" if order is not delivered yet ("delivering")
  // "Đã giao" after order is delivered ("delivered")
  assert.equal(
    getDeliveryDetailActionButtonLabel("delivering"),
    "Đánh dấu đã giao",
  );
  assert.equal(getDeliveryDetailActionButtonLabel("delivered"), "Đã giao");

  assert.equal(getDeliveryDetailStatusBadgeLabel("delivered", "done"), "Đã giao");
  assert.equal(
    getDeliveryDetailStatusBadgeLabel("delivering", "new"),
    "Cần giao",
  );
  assert.equal(
    getDeliveryDetailStatusBadgeLabel("delivering", "waiting"),
    "Đang chờ",
  );

  assert.equal(
    formatDeliveryDetailTimestamp({
      status: "delivered",
      time: "11:24",
      deliveredAt: "11:24",
    }),
    "Đã giao lúc 11:24",
  );
  assert.equal(
    formatDeliveryDetailTimestamp({
      status: "delivering",
      time: "10:24",
    }),
    "Đặt lúc 10:24",
  );

  assert.equal(
    getDeliveryOrderDishImage("Cơm sườn nướng"),
    "/delivery-order-com-suon-nuong.png",
  );
  assert.equal(
    getDeliveryOrderDishImage("Trà tắc"),
    "/delivery-order-tra-tac.png",
  );
  assert.equal(getDeliveryOrderDishUnitLabel("Cơm sườn nướng", 1), "1 phần");
  assert.equal(getDeliveryOrderDishUnitLabel("Trà tắc", 1), "1 ly");

  const order118 = resolveDeliveryOrderForDetail(
    initialMockDeliveryOrders,
    "#SF0118",
  );
  assert.ok(order118, "Order #SF0118 must exist in initialMockDeliveryOrders");
  assert.equal(order118.customerName, "Nguyễn Minh Anh");
  assert.equal(order118.phone, "0321 456 789");
  assert.equal(order118.dorm, "KTX A");
  assert.equal(order118.addressDetail, "Cổng B, Phòng 302");
  assert.equal(order118.total, 56000);
  assert.equal(order118.note, DEFAULT_DELIVERY_ORDER_NOTE);

  const dishes = getDeliveryOrderDishItems(order118);
  assert.equal(dishes.length, 2);
  assert.deepEqual(
    dishes.map((d) => ({
      name: d.name,
      quantity: d.quantity,
      unitLabel: d.unitLabel,
      price: d.price,
      imageUrl: d.imageUrl,
    })),
    [
      {
        name: "Cơm sườn nướng",
        quantity: 1,
        unitLabel: "1 phần",
        price: 45000,
        imageUrl: "/delivery-order-com-suon-nuong.png",
      },
      {
        name: "Trà tắc",
        quantity: 1,
        unitLabel: "1 ly",
        price: 11000,
        imageUrl: "/delivery-order-tra-tac.png",
      },
    ],
  );
}

function testDeliveredOrderDetailMockupExactMatch() {
  const order118 = resolveDeliveryOrderForDetail(
    initialMockDeliveryOrders,
    "#SF0118",
  );
  const html = renderToStaticMarkup(
    React.createElement(DeliveryOrderDetailModal, { order: order118 }),
  );

  // Header & Order meta
  assert.ok(html.includes('data-testid="delivery-order-detail-modal"'));
  assert.ok(html.includes("Chi tiết đơn hàng"));
  assert.ok(html.includes("#SF0118"));
  assert.ok(html.includes("Đã giao"));
  assert.ok(html.includes("Đã giao lúc 11:24"));

  // Card 1: Khách hàng
  assert.ok(html.includes("Khách hàng"));
  assert.ok(html.includes("Nguyễn Minh Anh"));
  assert.ok(html.includes("0321 456 789"));
  assert.ok(html.includes('href="tel:0321456789"'));
  assert.ok(html.includes("<span>Gọi khách</span>"));
  assert.ok(html.includes("KTX A"));
  assert.ok(html.includes("Cổng B, Phòng 302"));

  // Card 2: Món ăn
  assert.ok(html.includes("Món ăn"));
  assert.ok(html.includes("Cơm sườn nướng"));
  assert.ok(html.includes('src="/delivery-order-com-suon-nuong.png"'));
  assert.ok(html.includes("1 phần"));
  assert.ok(html.includes("45.000đ"));

  assert.ok(html.includes("Trà tắc"));
  assert.ok(html.includes('src="/delivery-order-tra-tac.png"'));
  assert.ok(html.includes("1 ly"));
  assert.ok(html.includes("11.000đ"));
  assert.ok(html.includes("x1"));

  // Card 3: Thanh toán & Tổng tiền
  assert.ok(html.includes("Thanh toán"));
  assert.ok(html.includes("Tiền mặt"));
  assert.ok(html.includes("Tổng tiền"));
  assert.ok(html.includes("56.000đ"));

  // Card 4: Ghi chú đơn hàng
  assert.ok(html.includes("Ghi chú đơn hàng"));
  assert.ok(html.includes("Gọi trước khi giao."));

  // Bottom buttons: "Đã giao" (since status === "delivered") and "Đóng"
  assert.ok(html.includes('data-testid="delivery-detail-status-action-btn"'));
  assert.ok(html.includes('data-delivery-status="delivered"'));
  assert.ok(html.includes("<span>Đã giao</span>"));
  assert.ok(html.includes(">Đóng</button>"));
}

function testDeliveringToDeliveredButtonTransition() {
  // 1. Before delivery (status === "delivering", e.g. #SF0128 Nguyễn Minh Anh)
  const undeliveredOrder = resolveDeliveryOrderForDetail(
    initialMockDeliveryOrders,
    "#SF0128",
  );
  assert.equal(undeliveredOrder.status, "delivering");

  const undeliveredHtml = renderToStaticMarkup(
    React.createElement(DeliveryDashboard, {
      initialDetailOrderId: "#SF0128",
    }),
  );

  assert.ok(undeliveredHtml.includes('data-order-code="#SF0128"'));
  assert.ok(undeliveredHtml.includes('data-delivery-status="delivering"'));
  assert.ok(
    undeliveredHtml.includes("<span>Đánh dấu đã giao</span>"),
    "Undelivered order must render 'Đánh dấu đã giao' button in Chi tiết đơn hàng",
  );

  // 2. Simulate shipper clicking "Đánh dấu đã giao" on the order
  const deliveredOrder = {
    ...undeliveredOrder,
    status: "delivered",
    badgeState: "done",
    deliveredAt: "11:24",
  };
  const deliveredHtml = renderToStaticMarkup(
    React.createElement(DeliveryOrderDetailModal, { order: deliveredOrder }),
  );
  assert.ok(deliveredHtml.includes('data-delivery-status="delivered"'));
  assert.ok(
    deliveredHtml.includes("<span>Đã giao</span>"),
    "After marking as delivered, the button must display 'Đã giao'",
  );
  assert.equal(
    deliveredHtml.includes("<span>Đánh dấu đã giao</span>"),
    false,
    "Delivered order must not display 'Đánh dấu đã giao'",
  );
}

function run() {
  testViewportAssetsAndDesktopMobilePopupStyles();
  testDeliveryDetailHelpersAndButtonLabelStateLogic();
  testDeliveredOrderDetailMockupExactMatch();
  testDeliveringToDeliveredButtonTransition();
  console.log(
    "PASS: Seller 'Chi tiết đơn hàng' (Quyền giao hàng) Mobile & Desktop popup UI, exact mockup match (#SF0118 / #SF0128 Nguyễn Minh Anh), 'Đánh dấu đã giao' -> 'Đã giao' button state transition, and responsive styles verified (4 test suites).",
  );
}

run();
