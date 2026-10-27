/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    const mapped = path.join(root, request.slice(2));
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".css"] = (module, filename) => {
  const css = fs.readFileSync(filename, "utf8");
  const proxy = new Proxy(
    { __rawCss: css, __esModule: true },
    {
      get(target, prop) {
        if (prop === "default") return proxy;
        if (prop in target) return target[prop];
        return String(prop);
      },
    },
  );
  module.exports = proxy;
};

const compileTs = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
};

require.extensions[".ts"] = compileTs;
require.extensions[".tsx"] = compileTs;

const { exploreRestaurants } = require("@/lib/explore/mock-data");
const { popularDishCards } = require("@/lib/explore/popular-data");
const {
  categories,
  initialExploreFilters,
  isAllExploreFilters,
  filterAndSortExploreRestaurants,
} = require("@/lib/explore/useExplore");
const ExploreHero = require("@/components/features/explore/ExploreHero").default;
const ExploreFilters =
  require("@/components/features/explore/ExploreFilters").default;
const ExploreResultsSection =
  require("@/components/features/explore/ExploreResultsSection").default;
const PopularDishesSection =
  require("@/components/features/explore/PopularDishesSection").default;
const ExploreView = require("@/components/features/explore/ExploreView").default;

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`PASS: ${name}`);
}

test("Design tokens, font family, and mobile viewport / safe-area configuration", () => {
  const globalsCss = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(globalsCss, /--sf-page:\s*#f8f4ee/i, "Cream page background token");
  assert.match(globalsCss, /--sf-card:\s*#ffffff/i, "White card token");
  assert.match(globalsCss, /--sf-ink:\s*#081447/i, "Navy ink text token");
  assert.match(globalsCss, /--sf-orange:\s*#ff4d12/i, "Orange accent #ff4d12 token");
  assert.match(
    globalsCss,
    /font-family:\s*Arial,\s*Helvetica,\s*sans-serif/i,
    "Arial/Helvetica font family",
  );

  const studentLayout = fs.readFileSync(
    path.join(root, "app/(student)/layout.tsx"),
    "utf8",
  );
  assert.match(studentLayout, /width:\s*"device-width"/);
  assert.match(studentLayout, /initialScale:\s*1/);
  assert.match(studentLayout, /viewportFit:\s*"cover"/);
  assert.match(studentLayout, /<StudentHeader\s*\/>/);
  assert.match(studentLayout, /<StudentBottomNavigation\s*\/>/);

  const mobileNavCss = fs.readFileSync(
    path.join(root, "styles/student-mobile-navigation.module.css"),
    "utf8",
  );
  assert.match(mobileNavCss, /env\(safe-area-inset-bottom/);
  assert.match(mobileNavCss, /@media\s*\(max-width:\s*760px\)/);
  assert.match(mobileNavCss, /@media\s*\(max-width:\s*360px\)/);

  const exploreCss = fs.readFileSync(
    path.join(root, "styles/explore.module.css"),
    "utf8",
  );
  assert.match(exploreCss, /@media\s*\(max-width:\s*760px\)/);
  assert.match(exploreCss, /@media\s*\(max-width:\s*430px\)/);
  assert.match(exploreCss, /@media\s*\(max-width:\s*380px\)/);
  assert.match(exploreCss, /@media\s*\(max-width:\s*360px\)/);
  assert.match(
    exploreCss,
    /\.restaurantGrid\[data-compact="true"\]\s*>\s*:nth-child\(n\s*\+\s*7\)/,
  );
});

test("Top 6 featured Explore restaurants and popular dishes match mockup", () => {
  const topSix = filterAndSortExploreRestaurants(
    exploreRestaurants,
    initialExploreFilters,
  ).slice(0, 6);

  assert.deepEqual(
    topSix.map((r) => ({
      slug: r.slug,
      name: r.name,
      location: r.location,
      categories: r.categories,
      isOpen: r.isOpen,
    })),
    [
      {
        slug: "com-co-ba",
        name: "Cơm Cô Ba",
        location: "KTX A",
        categories: ["Cơm", "Món Việt"],
        isOpen: true,
      },
      {
        slug: "tra-sua-nha-lam",
        name: "Trà Sữa Nhà Làm",
        location: "KTX B",
        categories: ["Trà sữa", "Đồ uống"],
        isOpen: true,
      },
      {
        slug: "bun-cha-ha-noi",
        name: "Bún Chả Hà Nội",
        location: "KTX A",
        categories: ["Bún", "Món Việt"],
        isOpen: true,
      },
      {
        slug: "mi-cay-seoul",
        name: "Mì Cay Seoul",
        location: "KTX B",
        categories: ["Món Hàn", "Ăn vặt"],
        isOpen: true,
      },
      {
        slug: "an-vat-5k",
        name: "Ăn Vặt 5K",
        location: "KTX A",
        categories: ["Ăn vặt", "Đồ chiên"],
        isOpen: true,
      },
      {
        slug: "com-tam-dem",
        name: "Cơm Tấm Đêm",
        location: "KTX B",
        categories: ["Cơm", "Món Việt"],
        isOpen: true,
      },
    ],
  );

  const topThreeDishes = popularDishCards.slice(0, 3);
  assert.deepEqual(
    topThreeDishes.map((d) => ({
      name: d.name,
      price: d.price,
      restaurantName: d.restaurantName,
    })),
    [
      {
        name: "Cơm gà sốt teriyaki",
        price: 25000,
        restaurantName: "Cơm Cô Ba",
      },
      {
        name: "Trà sữa trân châu",
        price: 18000,
        restaurantName: "Trà Sữa Nhà Làm",
      },
      {
        name: "Bún chả đặc biệt",
        price: 28000,
        restaurantName: "Bún Chả Hà Nội",
      },
    ],
  );
});

test("Explore filter, search (with/without diacritics), and sort logic", () => {
  assert.equal(isAllExploreFilters(initialExploreFilters), true);
  assert.equal(
    isAllExploreFilters({ ...initialExploreFilters, openOnly: true }),
    false,
  );
  assert.equal(
    isAllExploreFilters({ ...initialExploreFilters, location: "KTX A" }),
    false,
  );
  assert.equal(
    isAllExploreFilters({ ...initialExploreFilters, category: "Cơm" }),
    false,
  );
  assert.equal(
    isAllExploreFilters({ ...initialExploreFilters, query: "cơm" }),
    false,
  );

  // Location filters
  const ktxA = filterAndSortExploreRestaurants(exploreRestaurants, {
    location: "KTX A",
  });
  assert.ok(ktxA.length > 0 && ktxA.every((r) => r.location === "KTX A"));

  const ktxB = filterAndSortExploreRestaurants(exploreRestaurants, {
    location: "KTX B",
  });
  assert.ok(ktxB.length > 0 && ktxB.every((r) => r.location === "KTX B"));

  // Category filters
  for (const cat of categories) {
    const filtered = filterAndSortExploreRestaurants(exploreRestaurants, {
      category: cat,
    });
    assert.ok(
      filtered.length > 0 &&
        filtered.every((r) => r.categories.includes(cat)),
      `Category filter "${cat}" returns matching restaurants`,
    );
  }

  // Search without diacritics by restaurant name and dish searchTerms
  const byRestaurantName = filterAndSortExploreRestaurants(exploreRestaurants, {
    query: "mi cay seoul",
  });
  assert.deepEqual(
    byRestaurantName.map((r) => r.slug),
    ["mi-cay-seoul"],
  );

  const byDishName = filterAndSortExploreRestaurants(exploreRestaurants, {
    query: "teriyaki",
  });
  assert.deepEqual(
    byDishName.map((r) => r.slug),
    ["com-co-ba"],
  );

  // Open only filter
  const withClosed = exploreRestaurants.map((r, idx) =>
    idx === 0 ? { ...r, isOpen: false } : r,
  );
  assert.equal(
    filterAndSortExploreRestaurants(withClosed, { openOnly: true }).length,
    exploreRestaurants.length - 1,
  );

  // Sort by name (Vietnamese A-Z)
  const sortedByName = filterAndSortExploreRestaurants(exploreRestaurants, {
    sortBy: "name",
  });
  for (let i = 1; i < sortedByName.length; i++) {
    assert.ok(
      sortedByName[i - 1].name.localeCompare(sortedByName[i].name, "vi") <= 0,
    );
  }

  // Sort by menu count descending
  const sortedByMenu = filterAndSortExploreRestaurants(exploreRestaurants, {
    sortBy: "menu",
  });
  for (let i = 1; i < sortedByMenu.length; i++) {
    assert.ok(sortedByMenu[i - 1].menuCount >= sortedByMenu[i].menuCount);
  }

  // Empty search result
  assert.equal(
    filterAndSortExploreRestaurants(exploreRestaurants, {
      query: "mon-khong-ton-tai-xyz",
    }).length,
    0,
  );
});

test("ExploreHero and ExploreFilters render exact texts, placeholders, and ARIA states", () => {
  const heroHtml = renderToStaticMarkup(
    React.createElement(ExploreHero, {
      searchInput: "",
      onSearchInputChange: () => {},
      onSubmitSearch: () => {},
    }),
  );
  assert.match(heroHtml, /Khám phá món ngon quanh\s*<span>khu ký túc xá<\/span>/);
  assert.match(
    heroHtml,
    /Khám phá các quán ăn ngon, đa dạng món ăn và ưu đãi hấp dẫn dành riêng cho sinh viên\./,
  );
  assert.match(heroHtml, /placeholder="Tìm quán ăn hoặc món ăn\.\.\."/);
  assert.match(heroHtml, /aria-label="Tìm quán ăn hoặc món ăn"/);
  assert.match(heroHtml, />Tìm kiếm<\/button>/);

  const filtersHtml = renderToStaticMarkup(
    React.createElement(ExploreFilters, {
      isAllSelected: true,
      openOnly: false,
      location: "all",
      category: null,
      onReset: () => {},
      onToggleOpenOnly: () => {},
      onSelectLocation: () => {},
      onSelectCategory: () => {},
    }),
  );
  assert.match(filtersHtml, /aria-label="Bộ lọc khám phá"/);
  assert.match(filtersHtml, /aria-pressed="true"[^>]*>Tất cả<\/button>/);
  for (const label of [
    "Đang mở",
    "KTX A",
    "KTX B",
    "Cơm",
    "Trà sữa",
    "Ăn vặt",
    "Món Việt",
    "Món Hàn",
  ]) {
    assert.ok(filtersHtml.includes(label), `Filter pill "${label}" rendered`);
  }
});

test("ExploreResultsSection renders restaurant grid, sort selector, open/closed badges, and empty state", () => {
  const resultsHtml = renderToStaticMarkup(
    React.createElement(ExploreResultsSection, {
      restaurants: exploreRestaurants,
      sortBy: "popular",
      onSortChange: () => {},
      onResetFilters: () => {},
      compact: true,
    }),
  );
  assert.match(resultsHtml, /Kết quả khám phá/);
  assert.match(resultsHtml, /Sắp xếp:/);
  assert.match(resultsHtml, /Phổ biến/);
  assert.match(resultsHtml, /Tên A–Z/);
  assert.match(resultsHtml, /Nhiều món nhất/);
  assert.match(resultsHtml, /data-compact="true"/);
  assert.match(resultsHtml, /Đang mở/);
  assert.match(resultsHtml, /Xem quán/);

  for (const name of [
    "Cơm Cô Ba",
    "Trà Sữa Nhà Làm",
    "Bún Chả Hà Nội",
    "Mì Cay Seoul",
    "Ăn Vặt 5K",
    "Cơm Tấm Đêm",
  ]) {
    assert.ok(resultsHtml.includes(name), `Restaurant card "${name}" rendered`);
  }

  const emptyHtml = renderToStaticMarkup(
    React.createElement(ExploreResultsSection, {
      restaurants: [],
      sortBy: "popular",
      onSortChange: () => {},
      onResetFilters: () => {},
      compact: false,
    }),
  );
  assert.match(emptyHtml, /Không tìm thấy quán phù hợp\./);
  assert.match(emptyHtml, /Xóa bộ lọc/);
});

test("PopularDishesSection and full ExploreView render popular dishes horizontal list and links", () => {
  const popularHtml = renderToStaticMarkup(
    React.createElement(PopularDishesSection, {
      dishes: popularDishCards,
    }),
  );
  assert.match(popularHtml, /Món phổ biến hôm nay/);
  assert.match(popularHtml, /href="\/explore\/popular"/);
  assert.match(popularHtml, /Xem tất cả/);
  assert.match(popularHtml, /Cơm gà sốt teriyaki/);
  assert.match(popularHtml, /25\.000đ/);
  assert.match(popularHtml, /Trà sữa trân châu/);
  assert.match(popularHtml, /18\.000đ/);
  assert.match(popularHtml, /Bún chả đặc biệt/);
  assert.match(popularHtml, /28\.000đ/);
  assert.match(popularHtml, /Xem món/);

  const fullViewHtml = renderToStaticMarkup(
    React.createElement(ExploreView),
  );
  assert.match(fullViewHtml, /Khám phá món ngon quanh/);
  assert.match(fullViewHtml, /Kết quả khám phá/);
  assert.match(fullViewHtml, /Món phổ biến hôm nay/);
});

console.log(`\nAll ${passed} Explore UI test suites passed!`);
