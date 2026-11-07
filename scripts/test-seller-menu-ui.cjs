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
  if (request === "server-only") return {};
  if (request.endsWith("SellerAccessProvider")) return {useSellerAccess:()=>({data:{user:{id:"test-owner",role:"seller"},restaurant:{id:"test-shop",name:"TEST SHOP"}}})};
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
      usePathname: () => "/seller/menu",
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
  default: SellerMenuView,
  sellerMobileMenuTabs,
  sellerMobileMenuSortOptions,
  getSellerMobileMenuItemImage,
  formatSellerMobileMenuSubtitle,
  getSellerMobileMenuTabCounts,
  filterAndSortSellerMobileMenu,
  applySellerMobileMenuStatusChange,
} = require(
  path.join(projectRoot, "components/features/seller/SellerMenuView.tsx"),
);
const {
  menuStatus,
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

// Synthetic fixtures live only in this test. Production no longer supplies showcase data.
function createSellerMenuFixtures(restaurantId) {
 const names=["Cơm gà chiên","Cơm sườn nướng","Trà đào cam sả","Bánh tráng trộn"];
 const images=["/seller-menu-com-ga-chien.png","/seller-menu-com-suon-nuong.png","/seller-menu-tra-dao-cam-sa.png","/seller-menu-banh-trang-tron.png"];
 return Array.from({length:12},(_,i)=>({item:{id:`test-${i}`,restaurant_id:restaurantId,name:names[i]??`TEST ${i}`,slug:`test-${i}`,
 price:[30000,32000,25000,20000][i]??10000,category:i===2||i>=8&&i<=10?"Đồ uống":i===3?"Ăn vặt":"Cơm",
 image_url:images[i]??null,is_active:![3,11].includes(i),is_available:![1,7].includes(i),
 created_at:new Date(2026,0,12-i).toISOString(),updated_at:new Date(2026,0,12-i).toISOString()},optionCount:[3,2,1,0][i]??0}));
}

function testViewportAndResponsiveMenuStyles() {
  assert.equal(sellerLayout.viewport.width, "device-width");
  assert.equal(sellerLayout.viewport.initialScale, 1);
  assert.equal(sellerLayout.viewport.viewportFit, "cover");

  const menuCss = fs.readFileSync(
    path.join(projectRoot, "styles/seller-menu-list.module.css"),
    "utf8",
  );
  assert.match(menuCss, /\.desktopView\s*\{\s*display:\s*block;\s*\}/);
  assert.match(menuCss, /\.mobileView\s*\{\s*display:\s*none;\s*\}/);
  assert.match(menuCss, /env\(safe-area-inset-bottom/);
  assert.match(menuCss, /@media \(max-width: 760px\)/);
  assert.match(menuCss, /@media \(max-width: 440px\)/);
  assert.match(menuCss, /@media \(max-width: 393px\)/);
  assert.match(menuCss, /@media \(max-width: 360px\)/);

  const requiredImages = [
    "public/seller-menu-com-ga-chien.png",
    "public/seller-menu-com-suon-nuong.png",
    "public/seller-menu-tra-dao-cam-sa.png",
    "public/seller-menu-banh-trang-tron.png",
  ];
  for (const relativeImage of requiredImages) {
    assert.equal(
      fs.existsSync(path.join(projectRoot, relativeImage)),
      true,
      `Expected mobile menu dish thumbnail to exist at ${relativeImage}`,
    );
  }
}

function testMobileMenuCountsFilterSortAndStatusHelpers() {
  const fixtures = createSellerMenuFixtures(demoSellerRestaurant.id);
  const counts = getSellerMobileMenuTabCounts(fixtures);

  assert.deepEqual(counts, {
    all: 12,
    selling: 8,
    unavailable: 2,
    hidden: 2,
  });

  assert.deepEqual(
    sellerMobileMenuTabs.map((t) => [t.id, t.label]),
    [
      ["all", "Tất cả"],
      ["selling", "Đang bán"],
      ["unavailable", "Tạm hết"],
      ["hidden", "Đang ẩn"],
    ],
  );

  assert.deepEqual(
    sellerMobileMenuSortOptions.map((o) => [o.value, o.label]),
    [
      ["updated", "Mới cập nhật"],
      ["name", "Tên A–Z"],
      ["price", "Giá tăng dần"],
    ],
  );

  const mobileRows = filterAndSortSellerMobileMenu(fixtures, {
    query: "",
    category: "",
    tab: "all",
    sort: "updated",
  });
  assert.equal(mobileRows.length, 12);
  assert.equal(getSellerMobileMenuItemImage({...mobileRows[0].item,image_url:null}),null);
  assert.equal(getSellerMobileMenuItemImage({...mobileRows[0].item,image_url:"https://example.invalid/real.png"}),"https://example.invalid/real.png");

  // Newest timestamps determine order; image_url is authoritative.
  assert.deepEqual(
    mobileRows.slice(0, 4).map((r) => r.item.name),
    ["Cơm gà chiên", "Cơm sườn nướng", "Trà đào cam sả", "Bánh tráng trộn"],
  );

  // Card 1: Cơm gà chiên
  assert.equal(
    formatSellerMobileMenuSubtitle(
      mobileRows[0].item.category,
      mobileRows[0].optionCount,
    ),
    "Cơm • 3 tùy chọn",
  );
  assert.equal(mobileRows[0].item.price, 30000);
  assert.equal(menuStatus(mobileRows[0].item), "selling");
  assert.equal(
    getSellerMobileMenuItemImage(mobileRows[0].item),
    "/seller-menu-com-ga-chien.png",
  );

  // Card 2: Cơm sườn nướng
  assert.equal(
    formatSellerMobileMenuSubtitle(
      mobileRows[1].item.category,
      mobileRows[1].optionCount,
    ),
    "Cơm • 2 tùy chọn",
  );
  assert.equal(mobileRows[1].item.price, 32000);
  assert.equal(menuStatus(mobileRows[1].item), "unavailable");
  assert.equal(
    getSellerMobileMenuItemImage(mobileRows[1].item),
    "/seller-menu-com-suon-nuong.png",
  );

  // Card 3: Trà đào cam sả
  assert.equal(
    formatSellerMobileMenuSubtitle(
      mobileRows[2].item.category,
      mobileRows[2].optionCount,
    ),
    "Đồ uống • 1 tùy chọn",
  );
  assert.equal(mobileRows[2].item.price, 25000);
  assert.equal(menuStatus(mobileRows[2].item), "selling");
  assert.equal(
    getSellerMobileMenuItemImage(mobileRows[2].item),
    "/seller-menu-tra-dao-cam-sa.png",
  );

  // Card 4: Bánh tráng trộn
  assert.equal(
    formatSellerMobileMenuSubtitle(
      mobileRows[3].item.category,
      mobileRows[3].optionCount,
    ),
    "Ăn vặt • Không có tùy chọn",
  );
  assert.equal(mobileRows[3].item.price, 20000);
  assert.equal(mobileRows[3].item.is_active, false);
  assert.equal(menuStatus(mobileRows[3].item), "hidden");
  assert.equal(
    getSellerMobileMenuItemImage(mobileRows[3].item),
    "/seller-menu-banh-trang-tron.png",
  );

  // Filter by category ("Đồ uống")
  const drinksOnly = filterAndSortSellerMobileMenu(fixtures, {
    category: "Đồ uống",
  });
  assert.equal(drinksOnly.length, 4);
  assert.ok(drinksOnly.every((r) => r.item.category === "Đồ uống"));

  // Filter by search query (diacritic-insensitive)
  const searchByGa = filterAndSortSellerMobileMenu(fixtures, {
    query: "com ga",
  });
  assert.deepEqual(
    searchByGa.map((r) => r.item.name),
    ["Cơm gà chiên"],
  );

  // Filter by tab ("unavailable" -> 2 dishes)
  const unavailableRows = filterAndSortSellerMobileMenu(fixtures, {
    tab: "unavailable",
  });
  assert.equal(unavailableRows.length, 2);

  // Status transition helper
  assert.deepEqual(applySellerMobileMenuStatusChange("selling"), {
    is_available: true,
  });
  assert.deepEqual(applySellerMobileMenuStatusChange("unavailable"), {
    is_available: false,
  });
  assert.deepEqual(applySellerMobileMenuStatusChange("hidden"), {
    is_active: false,
  });
}

function testBottomNavigationMenuActiveState() {
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
  assert.ok(navHtml.includes("Tổng quan"));
  assert.ok(navHtml.includes("Đơn hàng"));
  assert.ok(navHtml.includes("Thực đơn"));
  assert.ok(navHtml.includes("Cửa hàng"));
}

function testSellerMenuViewMarkupAndDesktopPreservation() {
  useSellerPreviewStore.setState({ draft: null });
  useSellerPreviewStore.getInitialState().draft = null;
  useSellerMenuStore.setState({
    rows: createSellerMenuFixtures("test-shop"),
    restaurantId: "test-shop",
  });

  useSellerMenuStore.getInitialState().rows = useSellerMenuStore.getState().rows;
  useSellerMenuStore.getInitialState().restaurantId = "test-shop";
  const html = renderToStaticMarkup(React.createElement(SellerMenuView));

  // Both Desktop & Mobile containers must be rendered so Desktop UI is 100% preserved
  assert.ok(
    html.includes('class="desktopView"'),
    "Desktop Seller Menu view container must be preserved",
  );
  assert.ok(
    html.includes('class="mobileView"'),
    "Mobile Seller Menu view container must be rendered",
  );
  assert.ok(html.includes('data-testid="seller-menu-mobile"'));

  // Desktop-specific elements preserved intact
  assert.ok(
    html.includes(
      "Quản lý món ăn, giá bán và trạng thái hiển thị của cửa hàng bạn.",
    ),
  );
  assert.ok(html.includes("Thêm món mới"));
  assert.ok(html.includes("Danh sách món ăn"));
  assert.ok(html.includes("Gợi ý quản lý menu"));

  // Mobile Heading, CTA, Search, Category Filter & Manage Category
  assert.ok(html.includes("Thực đơn"));
  assert.ok(html.includes("Quản lý món ăn và trạng thái bán."));
  assert.ok(html.includes("Thêm món"));
  assert.ok(html.includes('placeholder="Tìm tên món ăn"'));
  assert.ok(html.includes("Danh mục: Tất cả"));
  assert.ok(html.includes("Quản lý danh mục"));

  // Mobile Status Tabs with exact counts: Tất cả 12, Đang bán 8, Tạm hết 2, Đang ẩn 2
  assert.match(
    html,
    /<span class="mobileTabLabel">Tất cả<\/span><strong class="mobileTabCount">12<\/strong>/,
  );
  assert.match(
    html,
    /<span class="mobileTabLabel">Đang bán<\/span><strong class="mobileTabCount">8<\/strong>/,
  );
  assert.match(
    html,
    /<span class="mobileTabLabel">Tạm hết<\/span><strong class="mobileTabCount">2<\/strong>/,
  );
  assert.match(
    html,
    /<span class="mobileTabLabel">Đang ẩn<\/span><strong class="mobileTabCount">2<\/strong>/,
  );

  // Mobile Summary & Sort Row
  assert.ok(html.includes('<span class="mobileDishCount">12 món</span>'));
  assert.ok(html.includes("Mới cập nhật"));

  // Top 4 Mobile Cards matching mockup 100% in exact order
  const mobileSectionStart = html.indexOf('data-testid="seller-menu-mobile"');
  const mobileHtml = html.slice(mobileSectionStart);

  const idxComGa = mobileHtml.indexOf("<h3>Cơm gà chiên</h3>");
  const idxComSuon = mobileHtml.indexOf("<h3>Cơm sườn nướng</h3>");
  const idxTraDao = mobileHtml.indexOf("<h3>Trà đào cam sả</h3>");
  const idxBanhTrang = mobileHtml.indexOf("<h3>Bánh tráng trộn</h3>");

  assert.ok(idxComGa !== -1 && idxComSuon !== -1 && idxTraDao !== -1 && idxBanhTrang !== -1);
  assert.ok(
    idxComGa < idxComSuon && idxComSuon < idxTraDao && idxTraDao < idxBanhTrang,
    "Mobile menu cards must appear in exact mockup order: Cơm gà chiên, Cơm sườn nướng, Trà đào cam sả, Bánh tráng trộn",
  );

  // Subtitles & Prices & Images & Status texts
  assert.ok(mobileHtml.includes("Cơm • 3 tùy chọn"));
  assert.ok(mobileHtml.includes("30.000đ"));
  assert.ok(mobileHtml.includes('src="/seller-menu-com-ga-chien.png"'));

  assert.ok(mobileHtml.includes("Cơm • 2 tùy chọn"));
  assert.ok(mobileHtml.includes("32.000đ"));
  assert.ok(mobileHtml.includes('src="/seller-menu-com-suon-nuong.png"'));

  assert.ok(mobileHtml.includes("Đồ uống • 1 tùy chọn"));
  assert.ok(mobileHtml.includes("25.000đ"));
  assert.ok(mobileHtml.includes('src="/seller-menu-tra-dao-cam-sa.png"'));

  assert.ok(mobileHtml.includes("Ăn vặt • Không có tùy chọn"));
  assert.ok(mobileHtml.includes("20.000đ"));
  assert.ok(mobileHtml.includes("Khách chưa thấy món"));
  assert.ok(mobileHtml.includes('src="/seller-menu-banh-trang-tron.png"'));

  assert.ok(mobileHtml.includes("Đang hiển thị"));
  assert.ok(mobileHtml.includes('data-status="selling"'));
  assert.ok(mobileHtml.includes('data-status="unavailable"'));
  assert.ok(mobileHtml.includes('data-status="hidden"'));
}

function run() {
  testViewportAndResponsiveMenuStyles();
  testMobileMenuCountsFilterSortAndStatusHelpers();
  testBottomNavigationMenuActiveState();
  testSellerMenuViewMarkupAndDesktopPreservation();
  console.log(
    "PASS: Seller Menu (Thực đơn) mobile UI, Desktop preservation, dish thumbnails, filters, and bottom navigation verified (4 test suites).",
  );
}

run();
