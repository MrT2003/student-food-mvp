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

const DishView = require("@/components/features/dish/DishView").default;
const DrinkCustomizationView =
  require("@/components/features/dish/DrinkCustomizationView").default;
const FoodCustomizationView =
  require("@/components/features/dish/FoodCustomizationView").default;
const {
  RICE_FOOD_EXTRAS,
  getDefaultSelectedOptions,
  previewDrinkItem,
  previewDrinkRestaurant,
  previewFoodItem,
  resolveDishOptionGroups,
} = require("@/lib/dish/options");
const {
  toggleSelectedOption,
  resolveSelectedOptions,
  getEstimatedUnitPrice,
} = require("@/lib/cart/options");
const { useStudentMockStore } = require("@/store/useStudentMockStore");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`PASS: ${name}`);
}

const initialStoreState = useStudentMockStore.getState();
const resetStore = () => {
  useStudentMockStore.setState(initialStoreState, true);
};

test("Design tokens, typography, horizontal option cards, and mobile viewport configuration", () => {
  const globalsCss = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(globalsCss, /--sf-page:\s*#f8f4ee/i, "Cream page background token");
  assert.match(globalsCss, /--sf-card:\s*#ffffff/i, "White card token");
  assert.match(globalsCss, /--sf-ink:\s*#081447/i, "Navy ink text token");
  assert.match(globalsCss, /--sf-orange:\s*#ff4d12/i, "Orange accent #ff4d12 token");

  const dishCss = fs.readFileSync(
    path.join(root, "styles/dish.module.css"),
    "utf8",
  );
  assert.match(dishCss, /env\(safe-area-inset-bottom/);
  assert.match(dishCss, /@media\s*\(max-width:\s*760px\)/);
  assert.match(dishCss, /@media\s*\(max-width:\s*430px\)/);
  assert.match(dishCss, /@media\s*\(max-width:\s*380px\)/);
  assert.match(dishCss, /@media\s*\(max-width:\s*360px\)/);

  // Verify no underline on mainPrice, toppingPrice, bottomTotalValue, and totalRow output
  const mainPriceBlock = dishCss.match(/\.mainPrice\s*\{[^}]+\}/)?.[0] ?? "";
  const toppingPriceBlock = dishCss.match(/\.toppingPrice\s*\{[^}]+\}/)?.[0] ?? "";
  const bottomTotalBlock = dishCss.match(/\.bottomTotalValue\s*\{[^}]+\}/)?.[0] ?? "";
  const totalRowOutputBlock = dishCss.match(/\.totalRow\s+output\s*\{[^}]+\}/)?.[0] ?? "";
  assert.doesNotMatch(mainPriceBlock, /text-decoration:\s*underline/i);
  assert.doesNotMatch(toppingPriceBlock, /text-decoration:\s*underline/i);
  assert.doesNotMatch(bottomTotalBlock, /text-decoration:\s*underline/i);
  assert.doesNotMatch(totalRowOutputBlock, /text-decoration:\s*underline/i);

  // Verify horizontal card layout on toppingOption, sugarOption, iceOption
  for (const selector of [".toppingOption", ".sugarOption", ".iceOption"]) {
    const escaped = selector.replace(".", "\\.");
    const block = dishCss.match(new RegExp(`${escaped}\\s*\\{[^}]+\\}`))?.[0] ?? "";
    assert.match(block, /flex-direction:\s*row/i, `${selector} is a horizontal card`);
  }
});

test("Drink customization screen restores dish placeholder and omits option/section illustrations", () => {
  const html = renderToStaticMarkup(React.createElement(DrinkCustomizationView));

  // Back link & overview card
  assert.match(html, /href="\/restaurants\/tra-sua-nha-lam"/);
  assert.match(html, /Quay lại quán/);
  assert.match(html, /Trà sữa truyền thống/);
  assert.match(html, /Đang bán/);
  assert.match(html, /20\.000đ/);
  assert.match(html, /Trà Sữa Nhà Làm/);
  assert.match(html, /KTX B/);
  assert.match(html, /Đồ uống/);
  assert.match(
    html,
    /Trà sữa thơm béo, vị trà đậm đà hòa quyện cùng sữa tươi, là lựa chọn quen thuộc được nhiều bạn yêu thích\./,
  );

  // Placeholder restored & small illustrations omitted
  assert.doesNotMatch(html, /GOOD<\/text>/);
  assert.doesNotMatch(html, /sectionSvgIcon/);
  assert.doesNotMatch(html, /toppingArt/);
  assert.doesNotMatch(html, /optionSvg/);

  // Info banner
  assert.match(
    html,
    /Hãy chọn topping, mức đường, mức đá và số lượng trước khi thêm vào giỏ hàng nhé!/,
  );

  // Topping thêm section
  assert.match(html, /Topping thêm/);
  assert.match(html, /Chọn thêm topping yêu thích \(có thể chọn nhiều\)/);
  assert.match(html, /Trân châu đen/);
  assert.match(html, /\+5\.000đ/);
  assert.match(html, /Thạch trái cây/);
  assert.match(html, /\+4\.000đ/);
  assert.match(html, /Pudding/);
  assert.match(html, /\+6\.000đ/);

  // Mức đường section
  assert.match(html, /Mức đường/);
  assert.match(html, /Chọn độ ngọt phù hợp với khẩu vị của bạn/);
  for (const [pct, desc] of [
    ["100%", "Rất ngọt"],
    ["70%", "Ngọt vừa"],
    ["50%", "Ít ngọt"],
    ["30%", "Hơi ngọt"],
    ["0%", "Không đường"],
  ]) {
    assert.ok(html.includes(pct), `Sugar percentage ${pct} rendered`);
    assert.ok(html.includes(desc), `Sugar description ${desc} rendered`);
  }

  // Mức đá section
  assert.match(html, /Mức đá/);
  assert.match(html, /Chọn lượng đá phù hợp/);
  for (const ice of ["Bình thường", "Ít đá", "Không đá"]) {
    assert.ok(html.includes(ice), `Ice option ${ice} rendered`);
  }

  // Số lượng & Tạm tính 29.000đ (20.000đ + 5.000đ + 4.000đ)
  assert.match(html, /Số lượng/);
  assert.match(html, /aria-label="Giảm số lượng"/);
  assert.match(html, /aria-label="Tăng số lượng"/);
  assert.match(html, /Tạm tính/);
  assert.match(html, /29\.000đ/);
  assert.match(html, /Thêm vào giỏ hàng/);
});

test("Food customization screen (Quán cơm - Món thêm) renders all 8 rice add-on options and calculates totals", () => {
  assert.equal(RICE_FOOD_EXTRAS.length, 8);
  assert.deepEqual(
    RICE_FOOD_EXTRAS.map((e) => ({ name: e.name, price: e.additional_price })),
    [
      { name: "Cơm thêm", price: 5000 },
      { name: "Canh thêm", price: 5000 },
      { name: "Sườn thêm", price: 15000 },
      { name: "Trứng thêm", price: 7000 },
      { name: "Bì thêm", price: 5000 },
      { name: "Chả thêm", price: 7000 },
      { name: "Nước mắm thêm", price: 0 },
      { name: "Muỗng / đũa thêm", price: 0 },
    ],
  );

  const foodHtml = renderToStaticMarkup(
    React.createElement(FoodCustomizationView),
  );

  assert.match(foodHtml, /href="\/restaurants\/com-co-ba"/);
  assert.match(foodHtml, /Quay lại quán/);
  assert.match(foodHtml, /Cơm sườn nướng/);
  assert.match(foodHtml, /Đang bán/);
  assert.match(foodHtml, /32\.000đ/);
  assert.match(foodHtml, /Cơm Cô Ba/);
  assert.match(foodHtml, /KTX A/);
  assert.match(foodHtml, /Cơm/);
  assert.doesNotMatch(foodHtml, /sectionSvgIcon/);
  assert.doesNotMatch(foodHtml, /toppingArt/);
  assert.doesNotMatch(foodHtml, /optionSvg/);
  assert.match(
    foodHtml,
    /Hãy chọn món thêm và số lượng trước khi thêm vào giỏ hàng nhé!/,
  );
  assert.match(foodHtml, /Món thêm/);
  assert.match(foodHtml, /Chọn thêm món ăn kèm yêu thích \(có thể chọn nhiều\)/);

  for (const extraName of [
    "Cơm thêm",
    "Canh thêm",
    "Sườn thêm",
    "Trứng thêm",
    "Bì thêm",
    "Chả thêm",
    "Nước mắm thêm",
    "Muỗng / đũa thêm",
  ]) {
    assert.ok(
      foodHtml.includes(extraName),
      `Food extra option "${extraName}" rendered`,
    );
  }

  // Test pre-selecting Cơm thêm (+5.000đ), Sườn thêm (+15.000đ), Trứng thêm (+7.000đ), Nước mắm thêm (0đ), Muỗng / đũa thêm (0đ) with quantity 2
  const foodGroups = resolveDishOptionGroups(previewFoodItem);
  const foodOptions = foodGroups[0].options;
  const pickedIds = foodOptions
    .filter((o) =>
      [
        "Cơm thêm",
        "Sườn thêm",
        "Trứng thêm",
        "Nước mắm thêm",
        "Muỗng / đũa thêm",
      ].includes(o.option_name),
    )
    .map((o) => o.id);

  const customFoodHtml = renderToStaticMarkup(
    React.createElement(FoodCustomizationView, {
      defaultSelectedOptionIds: pickedIds,
      defaultQuantity: 2,
    }),
  );

  // (32.000 + 5.000 + 15.000 + 7.000 + 0 + 0) * 2 = 59.000 * 2 = 118.000đ
  assert.match(customFoodHtml, /118\.000đ/);
});

test("Option selection logic, price calculation, unavailable states, and cart integration", () => {
  resetStore();

  const drinkGroups = resolveDishOptionGroups(previewDrinkItem);
  const defaults = getDefaultSelectedOptions(previewDrinkItem, drinkGroups);
  assert.equal(defaults.length, 4, "2 toppings + 1 sugar + 1 ice selected by default");

  const unitPrice = getEstimatedUnitPrice(previewDrinkItem, defaults);
  assert.equal(unitPrice, 29000, "20000 base + 5000 pearl + 4000 jelly = 29000");

  // Toggle Pudding (+6.000đ) on and Trân châu đen (-5.000đ) off
  const toppingGroup = drinkGroups[0];
  const sugarGroup = drinkGroups[1];
  const puddingOpt = toppingGroup.options.find((o) => o.option_name === "Pudding");
  const pearlOpt = toppingGroup.options.find((o) =>
    o.option_name.includes("Trân châu"),
  );
  const zeroSugarOpt = sugarGroup.options.find((o) =>
    o.option_name.startsWith("0%"),
  );

  let updated = toggleSelectedOption(defaults, toppingGroup, puddingOpt.id);
  updated = toggleSelectedOption(updated, toppingGroup, pearlOpt.id);
  updated = toggleSelectedOption(updated, sugarGroup, zeroSugarOpt.id);

  const newUnitPrice = getEstimatedUnitPrice(previewDrinkItem, updated);
  assert.equal(newUnitPrice, 30000, "20000 base + 4000 jelly + 6000 pudding = 30000");

  const resolved = resolveSelectedOptions(previewDrinkItem, updated);
  assert.ok(resolved.some((r) => r.option_name === "0% đường"));
  assert.ok(resolved.some((r) => r.option_name === "Pudding"));

  // Add to mock cart store and verify cart item
  const addRes = useStudentMockStore.getState().addCatalogItem({
    restaurant_id: previewDrinkRestaurant.id,
    menu_item_id: previewDrinkItem.id,
    quantity: 2,
    selected_options: defaults,
  });
  assert.equal(addRes.ok, true);
  assert.equal(useStudentMockStore.getState().cart_items.length, 1);
  assert.equal(useStudentMockStore.getState().cart_items[0].quantity, 2);

  // Unavailable item state renders "Hết món" and "Hiện không thể đặt món"
  const unavailableHtml = renderToStaticMarkup(
    React.createElement(DishView, {
      restaurant: previewDrinkRestaurant,
      item: { ...previewDrinkItem, is_available: false },
    }),
  );
  assert.match(unavailableHtml, /Hết món/);
  assert.match(unavailableHtml, /Hiện không thể đặt món/);

  resetStore();
});

console.log(`\nAll ${passed} Dish Customization UI test suites passed!`);
