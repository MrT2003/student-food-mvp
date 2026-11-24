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
      usePathname: () => "/seller/menu/new",
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
  confirm: () => true,
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
  default: SellerMenuCreateView,
  DEFAULT_SELLER_MOBILE_CREATE_IMAGE,
  DEFAULT_SELLER_MOBILE_CREATE_VALUES,
  createDefaultSellerMobileOptionGroups,
  formatSellerMobilePriceInput,
  parseSellerMobilePriceInput,
  formatSellerMobileOptionGroupSubtitle,
  formatSellerMobileOptionGroupPriceBadge,
  resolveSellerMobileSellingStatus,
  applySellerMobileSellingStatus,
  MenuVisibilitySvgIcon,
  SellingStatusSvgIcon,
  FeaturedDishSvgIcon,
} = require(
  path.join(projectRoot, "components/features/seller/SellerMenuCreateView.tsx"),
);
const {
  createSellerMenuFixtures,
} = require(path.join(projectRoot, "lib/seller/menu.ts"));
const {
  demoSellerRestaurant,
} = require(path.join(projectRoot, "lib/mocks/seller-orders.mock.ts"));
const {
  useSellerPreviewStore,
} = require(path.join(projectRoot, "store/useSellerPreviewStore.ts"));
const {
  useSellerMenuStore,
} = require(path.join(projectRoot, "store/useSellerMenuStore.ts"));

function testViewportAndResponsiveCreateStyles() {
  assert.equal(sellerLayout.viewport.width, "device-width");
  assert.equal(sellerLayout.viewport.initialScale, 1);
  assert.equal(sellerLayout.viewport.viewportFit, "cover");

  const createCss = fs.readFileSync(
    path.join(projectRoot, "styles/seller-menu-create.module.css"),
    "utf8",
  );
  assert.match(createCss, /\.desktopView\s*\{\s*display:\s*block;\s*\}/);
  assert.match(createCss, /\.mobileView\s*\{\s*display:\s*none;\s*\}/);
  assert.match(createCss, /env\(safe-area-inset-top/);
  assert.match(createCss, /env\(safe-area-inset-bottom/);
  assert.match(createCss, /@media \(max-width: 760px\)/);
  assert.match(createCss, /@media \(max-width: 440px\)/);
  assert.match(createCss, /@media \(max-width: 393px\)/);
  assert.match(createCss, /@media \(max-width: 360px\)/);

  assert.equal(
    fs.existsSync(
      path.join(projectRoot, "public/seller-menu-create-tra-sua.png"),
    ),
    true,
    "Expected mobile 'Thêm món mới' dish thumbnail to exist at public/seller-menu-create-tra-sua.png",
  );
}

function testMobileMenuCreateHelpersAndDefaults() {
  assert.deepEqual(DEFAULT_SELLER_MOBILE_CREATE_VALUES, {
    name: "Trà sữa truyền thống",
    price: 20000,
    category: "Đồ uống",
    description: "Trà sữa thơm béo, trân châu đen dai mềm.",
    image_url: "/seller-menu-create-tra-sua.png",
    is_active: true,
    is_available: true,
    featured: false,
  });

  assert.equal(
    DEFAULT_SELLER_MOBILE_CREATE_IMAGE,
    "/seller-menu-create-tra-sua.png",
  );

  assert.equal(formatSellerMobilePriceInput(20000), "20.000");
  assert.equal(formatSellerMobilePriceInput("20000"), "20.000");
  assert.equal(parseSellerMobilePriceInput("20.000"), "20000");

  const groups = createDefaultSellerMobileOptionGroups();
  assert.equal(groups.length, 3);

  // Group 1: Topping thêm
  assert.equal(groups[0].name, "Topping thêm");
  assert.equal(
    formatSellerMobileOptionGroupSubtitle(groups[0]),
    "Chọn nhiều · 3 lựa chọn",
  );
  assert.equal(
    formatSellerMobileOptionGroupPriceBadge(groups[0]),
    "+4.000 – 6.000đ",
  );

  // Group 2: Mức đường
  assert.equal(groups[1].name, "Mức đường");
  assert.equal(
    formatSellerMobileOptionGroupSubtitle(groups[1]),
    "Chọn một · 5 lựa chọn",
  );
  assert.equal(formatSellerMobileOptionGroupPriceBadge(groups[1]), null);

  // Group 3: Mức đá
  assert.equal(groups[2].name, "Mức đá");
  assert.equal(
    formatSellerMobileOptionGroupSubtitle(groups[2]),
    "Chọn một · 3 lựa chọn",
  );
  assert.equal(formatSellerMobileOptionGroupPriceBadge(groups[2]), null);

  // Selling status transitions
  assert.equal(resolveSellerMobileSellingStatus(true, false), "selling");
  assert.equal(resolveSellerMobileSellingStatus(true, true), "unavailable");
  assert.equal(resolveSellerMobileSellingStatus(false, false), "hidden");

  assert.deepEqual(applySellerMobileSellingStatus("selling"), {
    active: true,
    outOfStock: false,
  });
  assert.deepEqual(applySellerMobileSellingStatus("unavailable"), {
    active: true,
    outOfStock: true,
  });
  assert.deepEqual(applySellerMobileSellingStatus("hidden"), {
    active: false,
    outOfStock: false,
  });
}

function testDisplaySectionSvgIconsAndBottomNav() {
  const visIconHtml = renderToStaticMarkup(
    React.createElement(MenuVisibilitySvgIcon),
  );
  const statusIconHtml = renderToStaticMarkup(
    React.createElement(SellingStatusSvgIcon),
  );
  const featuredIconHtml = renderToStaticMarkup(
    React.createElement(FeaturedDishSvgIcon),
  );

  assert.ok(visIconHtml.startsWith("<svg"));
  assert.ok(visIconHtml.includes('data-testid="icon-menu-visibility"'));
  assert.ok(statusIconHtml.startsWith("<svg"));
  assert.ok(statusIconHtml.includes('data-testid="icon-selling-status"'));
  assert.ok(featuredIconHtml.startsWith("<svg"));
  assert.ok(featuredIconHtml.includes('data-testid="icon-featured-dish"'));

  const navHtml = renderToStaticMarkup(
    React.createElement(SellerBottomNavigation, {
      active: "menu",
      menuLabel: "Thực đơn",
    }),
  );
  assert.ok(
    navHtml.includes('aria-label="Điều hướng quản lý cửa hàng trên điện thoại"'),
  );
  assert.ok(navHtml.includes('href="/seller/menu"'));
  assert.ok(navHtml.includes('aria-current="page"'));
  assert.ok(navHtml.includes("Thực đơn"));
}

function testSellerMenuCreateViewMarkupAndDesktopPreservation() {
  useSellerPreviewStore.setState({ draft: null });
  useSellerPreviewStore.getInitialState().draft = null;
  useSellerMenuStore.setState({
    rows: createSellerMenuFixtures(demoSellerRestaurant.id),
  });

  const html = renderToStaticMarkup(React.createElement(SellerMenuCreateView));

  // Both Desktop & Mobile containers must be rendered so Desktop UI is 100% preserved
  assert.ok(
    html.includes('class="desktopView"'),
    "Desktop Seller Menu Create view container must be preserved",
  );
  assert.ok(
    html.includes('class="mobileView"'),
    "Mobile Seller Menu Create view container must be rendered",
  );
  assert.ok(html.includes('data-testid="seller-menu-create-mobile"'));

  // Desktop-specific elements preserved intact
  assert.ok(
    html.includes("Tạo món mới để hiển thị trên menu cửa hàng của bạn."),
  );
  assert.ok(html.includes("Xem trước với sinh viên"));
  assert.ok(html.includes("Gợi ý hoàn thiện"));
  assert.ok(html.includes("Trạng thái hiển thị"));

  // Extract Mobile section for focused assertions matching mockup 100%
  const mobileSectionStart = html.indexOf(
    'data-testid="seller-menu-create-mobile"',
  );
  const mobileHtml = html.slice(mobileSectionStart);

  // 1. Top Bar: Back button, Title "Thêm món mới", and "Xem trước"
  assert.ok(mobileHtml.includes('aria-label="Quay lại Menu"'));
  assert.ok(
    mobileHtml.includes('<h1 class="mobileTopTitle">Thêm món mới</h1>'),
  );
  assert.ok(
    mobileHtml.includes('data-testid="seller-menu-create-preview-trigger"'),
  );
  assert.ok(mobileHtml.includes("<span>Xem trước</span>"));

  // 2. Card 1: Thông tin cơ bản
  assert.ok(mobileHtml.includes(">Thông tin cơ bản</h2>"));
  assert.ok(mobileHtml.includes("Ảnh món <b>*</b>"));
  assert.ok(mobileHtml.includes('src="/seller-menu-create-tra-sua.png"'));
  assert.ok(mobileHtml.includes("<span>Đổi ảnh</span>"));
  assert.ok(mobileHtml.includes("JPG, PNG · Tối đa 5MB"));
  assert.ok(mobileHtml.includes("Tên món <b>*</b>"));
  assert.ok(mobileHtml.includes('value="Trà sữa truyền thống"'));
  assert.ok(mobileHtml.includes("Giá bán <b>*</b>"));
  assert.ok(mobileHtml.includes('value="20.000"'));
  assert.ok(mobileHtml.includes('<span class="mobilePriceSuffix">đ</span>'));
  assert.ok(mobileHtml.includes("Danh mục <b>*</b>"));
  assert.ok(
    mobileHtml.includes('<option value="Đồ uống" selected="">Đồ uống</option>'),
  );
  assert.ok(mobileHtml.includes("Mô tả ngắn"));
  assert.ok(
    mobileHtml.includes("Trà sữa thơm béo, trân châu đen dai mềm."),
  );

  // 3. Card 2: Tùy chọn món (Không bắt buộc)
  assert.ok(mobileHtml.includes("Tùy chọn món"));
  assert.ok(mobileHtml.includes("(Không bắt buộc)"));
  assert.ok(
    mobileHtml.includes("Thêm topping, mức đường hoặc mức đá."),
  );
  assert.ok(mobileHtml.includes("<strong>Topping thêm</strong>"));
  assert.ok(mobileHtml.includes("<small>Chọn nhiều · 3 lựa chọn</small>"));
  assert.ok(mobileHtml.includes("+4.000 – 6.000đ"));
  assert.ok(mobileHtml.includes("<strong>Mức đường</strong>"));
  assert.ok(mobileHtml.includes("<small>Chọn một · 5 lựa chọn</small>"));
  assert.ok(mobileHtml.includes("<strong>Mức đá</strong>"));
  assert.ok(mobileHtml.includes("<small>Chọn một · 3 lựa chọn</small>"));
  assert.ok(mobileHtml.includes("<span>Thêm nhóm tùy chọn</span>"));

  // 4. Card 3: Hiển thị & tình trạng bán + 3 SVG icons
  assert.ok(
    mobileHtml.includes('data-testid="seller-menu-create-display-section"'),
  );
  assert.ok(mobileHtml.includes(">Hiển thị &amp; tình trạng bán</h2>"));
  assert.ok(mobileHtml.includes('data-testid="icon-menu-visibility"'));
  assert.ok(mobileHtml.includes('data-testid="icon-selling-status"'));
  assert.ok(mobileHtml.includes('data-testid="icon-featured-dish"'));
  assert.ok(mobileHtml.includes("<strong>Hiển thị trên thực đơn</strong>"));
  assert.ok(mobileHtml.includes("<span>Khách có thể nhìn thấy món.</span>"));
  assert.ok(mobileHtml.includes("<strong>Tình trạng bán</strong>"));
  assert.ok(mobileHtml.includes('data-status="selling"'));
  assert.ok(
    mobileHtml.includes('<option value="selling" selected="">Đang bán</option>'),
  );
  assert.ok(mobileHtml.includes("<strong>Món nổi bật</strong>"));
  assert.ok(
    mobileHtml.includes("<span>Ưu tiên trong danh sách món.</span>"),
  );

  // 5. Bottom Actions: Hủy | Lưu món
  assert.ok(
    mobileHtml.includes('data-testid="seller-menu-create-mobile-actions"'),
  );
  const idxCancel = mobileHtml.indexOf(">Hủy</button>");
  const idxSave = mobileHtml.indexOf("<span>Lưu món</span>");
  assert.ok(idxCancel !== -1 && idxSave !== -1);
  assert.ok(
    idxCancel < idxSave,
    "Mobile action bar must render 'Hủy' on the left and 'Lưu món' on the right",
  );

  // 6. Verify top-to-bottom ordering matches mockup 100%
  const idxBasic = mobileHtml.indexOf(">Thông tin cơ bản</h2>");
  const idxOptions = mobileHtml.indexOf("Tùy chọn món");
  const idxTopping = mobileHtml.indexOf("<strong>Topping thêm</strong>");
  const idxSugar = mobileHtml.indexOf("<strong>Mức đường</strong>");
  const idxIce = mobileHtml.indexOf("<strong>Mức đá</strong>");
  const idxDisplay = mobileHtml.indexOf(">Hiển thị &amp; tình trạng bán</h2>");

  assert.ok(
    idxBasic < idxOptions &&
      idxOptions < idxTopping &&
      idxTopping < idxSugar &&
      idxSugar < idxIce &&
      idxIce < idxDisplay &&
      idxDisplay < idxCancel,
    "Mobile 'Thêm món mới' sections and option groups must appear in exact mockup order",
  );
}

function run() {
  testViewportAndResponsiveCreateStyles();
  testMobileMenuCreateHelpersAndDefaults();
  testDisplaySectionSvgIconsAndBottomNav();
  testSellerMenuCreateViewMarkupAndDesktopPreservation();
  console.log(
    "PASS: Seller Menu Create (Thêm món mới) mobile UI, Desktop preservation, SVG icons, option groups, and bottom actions verified (4 test suites).",
  );
}

run();
