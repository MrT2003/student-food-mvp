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
      usePathname: () => "/seller/payments",
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
} = require(
  path.join(projectRoot, "components/features/seller/SellerBottomNavigation.tsx"),
);
const {
  default: SellerPaymentView,
  VIETNAM_BANKS,
  DEFAULT_SELLER_TRANSFER_CONTENT,
  createInitialSellerPaymentPreview,
  validateSellerPaymentForm,
} = require(
  path.join(projectRoot, "components/features/seller/SellerPaymentView.tsx"),
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

function testViewportAndResponsivePaymentStyles() {
  assert.equal(sellerLayout.viewport.width, "device-width");
  assert.equal(sellerLayout.viewport.initialScale, 1);
  assert.equal(sellerLayout.viewport.viewportFit, "cover");

  const paymentCss = fs.readFileSync(
    path.join(projectRoot, "styles/seller-payments.module.css"),
    "utf8",
  );
  assert.match(paymentCss, /\.desktopView\s*\{[\s\S]*?display:\s*grid/);
  assert.match(paymentCss, /\.mobileView\s*\{\s*display:\s*none;\s*\}/);
  assert.match(paymentCss, /env\(safe-area-inset-top/);
  assert.match(paymentCss, /env\(safe-area-inset-bottom/);
  assert.match(paymentCss, /@media \(max-width: 760px\)/);
  assert.match(paymentCss, /@media \(max-width: 440px\)/);
  assert.match(paymentCss, /@media \(max-width: 393px\)/);
  assert.match(paymentCss, /@media \(max-width: 360px\)/);
}

function testVietnamBanksDropdownAndHelpers() {
  const requiredBanks = [
    "Vietcombank",
    "Techcombank",
    "Agribank",
    "BIDV",
    "VietinBank",
    "MB Bank",
    "ACB",
    "VPBank",
    "TPBank",
    "Sacombank",
    "HDBank",
    "VIB",
    "SHB",
    "MSB",
    "OCB",
    "SeABank",
    "LPBank",
    "Eximbank",
    "Bac A Bank",
    "PVcomBank",
    "ABBank",
    "Nam A Bank",
    "VietBank",
    "VietABank",
    "NCB",
    "BVBank",
    "KienlongBank",
    "Saigonbank",
    "PGBank",
    "BaoVietBank",
    "Shinhan Bank",
    "Woori Bank",
    "HSBC",
    "Standard Chartered",
    "UOB",
    "CIMB",
  ];

  for (const bank of requiredBanks) {
    assert.ok(
      VIETNAM_BANKS.includes(bank),
      `Expected VIETNAM_BANKS dropdown list to include ${bank}`,
    );
  }
  assert.ok(VIETNAM_BANKS.length >= 35);

  const initialPayment = createInitialSellerPaymentPreview(null);
  assert.deepEqual(initialPayment, {
    cashEnabledPreview: true,
    bankEnabledPreview: true,
    bank_name: "Vietcombank",
    account_no: "0901234567",
    account_name: "NGUYEN VAN A",
    branchPreview: "Chi nhánh Hà Nội",
  });
  assert.equal(
    DEFAULT_SELLER_TRANSFER_CONTENT,
    "Thanh toán đơn hàng StudentFood",
  );

  // Validation cases
  assert.equal(validateSellerPaymentForm(initialPayment), null);
  assert.equal(
    validateSellerPaymentForm({
      ...initialPayment,
      cashEnabledPreview: false,
      bankEnabledPreview: false,
    }),
    "Cần bật ít nhất một phương thức thanh toán.",
  );
  assert.equal(
    validateSellerPaymentForm({
      ...initialPayment,
      account_no: "123",
    }),
    "Nhập ngân hàng, số tài khoản 6–19 chữ số và tên chủ tài khoản.",
  );
}

function testBottomNavigationPresence() {
  const navHtml = renderToStaticMarkup(
    React.createElement(SellerBottomNavigation, {
      active: "payments",
    }),
  );
  assert.ok(
    navHtml.includes('aria-label="Điều hướng quản lý cửa hàng trên điện thoại"'),
  );
  assert.ok(navHtml.includes('href="/seller"'));
  assert.ok(navHtml.includes('href="/seller/orders"'));
  assert.ok(navHtml.includes('href="/seller/menu"'));
  assert.ok(navHtml.includes('href="/seller/shop"'));
}

function testSellerPaymentViewMarkupAndDesktopPreservation() {
  useSellerPreviewStore.setState({ draft: null });
  useSellerPreviewStore.getInitialState().draft = null;
  useSellerShopStore.setState({ shop: null });
  useSellerPaymentStore.setState({ saved: null });

  const html = renderToStaticMarkup(React.createElement(SellerPaymentView));

  // Both Desktop & Mobile containers must be rendered so Desktop UI is 100% preserved
  assert.ok(
    html.includes('class="desktopView"'),
    "Desktop Seller Payment view container must be preserved",
  );
  assert.ok(
    html.includes('class="mobileView"'),
    "Mobile Seller Payment view container must be rendered",
  );
  assert.ok(html.includes('data-testid="seller-payment-mobile"'));

  // Desktop-specific elements preserved intact
  assert.ok(
    html.includes(
      "Cài đặt phương thức thanh toán và thông tin tài khoản ngân hàng để nhận tiền từ sinh viên.",
    ),
  );
  assert.ok(html.includes("Phương thức đang bật"));
  assert.ok(html.includes("Trạng thái cấu hình"));
  assert.ok(html.includes("Cần hỗ trợ?"));
  assert.ok(html.includes("Xem trước QR thanh toán"));

  // Extract Mobile section for focused assertions matching mockup 100%
  const mobileSectionStart = html.indexOf('data-testid="seller-payment-mobile"');
  const mobileHtml = html.slice(mobileSectionStart);

  // Top Header & Subtitle
  assert.ok(mobileHtml.includes('aria-label="Quay lại Cửa hàng"'));
  assert.ok(mobileHtml.includes("<h1 class=\"mobileTopTitle\">Thanh toán</h1>"));
  assert.ok(
    mobileHtml.includes("Cài đặt phương thức nhận tiền của cửa hàng."),
  );

  // Card 1: Phương thức thanh toán
  assert.ok(mobileHtml.includes(">Phương thức thanh toán</h2>"));
  assert.ok(mobileHtml.includes("<strong>Tiền mặt</strong>"));
  assert.ok(mobileHtml.includes("<span>Khách thanh toán khi nhận món.</span>"));
  assert.ok(mobileHtml.includes('aria-label="Bật Tiền mặt"'));
  assert.ok(mobileHtml.includes("<strong>Chuyển khoản</strong>"));
  assert.ok(
    mobileHtml.includes("<span>Nhận tiền qua tài khoản ngân hàng.</span>"),
  );
  assert.ok(mobileHtml.includes('aria-label="Bật Chuyển khoản"'));
  assert.ok(
    mobileHtml.includes("<span>Bạn có thể bật một hoặc cả hai phương thức.</span>"),
  );

  // Card 2: Thông tin ngân hàng
  assert.ok(mobileHtml.includes(">Thông tin ngân hàng</h2>"));
  assert.ok(
    mobileHtml.includes("Dùng để tạo mã QR thanh toán cho từng đơn."),
  );
  assert.ok(mobileHtml.includes("Ngân hàng <b>*</b>"));
  assert.ok(mobileHtml.includes('<option value="Vietcombank" selected="">Vietcombank</option>'));
  assert.ok(mobileHtml.includes('<option value="Techcombank">Techcombank</option>'));
  assert.ok(mobileHtml.includes('<option value="Agribank">Agribank</option>'));
  assert.ok(mobileHtml.includes("Số tài khoản <b>*</b>"));
  assert.ok(mobileHtml.includes('value="0901234567"'));
  assert.ok(mobileHtml.includes("Tên chủ tài khoản <b>*</b>"));
  assert.ok(mobileHtml.includes('value="NGUYEN VAN A"'));
  assert.ok(mobileHtml.includes("(không bắt buộc)"));
  assert.ok(mobileHtml.includes('value="Chi nhánh Hà Nội"'));
  assert.ok(mobileHtml.includes("Nội dung chuyển khoản mặc định <b>*</b>"));
  assert.ok(mobileHtml.includes('value="Thanh toán đơn hàng StudentFood"'));
  assert.ok(
    mobileHtml.includes("Nội dung chuyển khoản có thể thay đổi theo từng đơn."),
  );

  // Card 3: Xem trước mã QR
  assert.ok(mobileHtml.includes('data-testid="seller-payment-qr-preview-trigger"'));
  assert.ok(mobileHtml.includes("<strong>Xem trước mã QR</strong>"));
  assert.ok(
    mobileHtml.includes("<span>QR được tạo theo thông tin ngân hàng.</span>"),
  );

  // Info Link: Hướng dẫn thiết lập thanh toán
  assert.ok(
    mobileHtml.includes("<span>Hướng dẫn thiết lập thanh toán</span>"),
  );

  // Bottom Actions: Hủy thay đổi | Lưu thay đổi
  assert.ok(mobileHtml.includes('data-testid="seller-payment-mobile-actions"'));
  const idxCancel = mobileHtml.indexOf(">Hủy thay đổi</button>");
  const idxSave = mobileHtml.indexOf(">Lưu thay đổi</button>");
  assert.ok(idxCancel !== -1 && idxSave !== -1);
  assert.ok(
    idxCancel < idxSave,
    "Mobile action bar must render 'Hủy thay đổi' on the left and 'Lưu thay đổi' on the right",
  );

  // Verify top-to-bottom section ordering matches mockup 100%
  const idxMethods = mobileHtml.indexOf(">Phương thức thanh toán</h2>");
  const idxBankInfo = mobileHtml.indexOf(">Thông tin ngân hàng</h2>");
  const idxQrPreview = mobileHtml.indexOf("<strong>Xem trước mã QR</strong>");
  const idxGuide = mobileHtml.indexOf("<span>Hướng dẫn thiết lập thanh toán</span>");

  assert.ok(
    idxMethods < idxBankInfo &&
      idxBankInfo < idxQrPreview &&
      idxQrPreview < idxGuide &&
      idxGuide < idxCancel,
    "Mobile payment sections must appear in exact mockup order: Phương thức thanh toán -> Thông tin ngân hàng -> Xem trước mã QR -> Hướng dẫn thiết lập thanh toán -> Hủy thay đổi / Lưu thay đổi",
  );
}

function run() {
  testViewportAndResponsivePaymentStyles();
  testVietnamBanksDropdownAndHelpers();
  testBottomNavigationPresence();
  testSellerPaymentViewMarkupAndDesktopPreservation();
  console.log(
    "PASS: Seller Payment (Thanh toán) mobile UI, Desktop preservation, Vietnam banks dropdown, form fields, QR preview trigger, and bottom actions verified (4 test suites).",
  );
}

run();
