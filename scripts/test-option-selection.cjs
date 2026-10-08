/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(outputText, filename);
};
const { toggleSelectedOption: toggle, clearSelectedOptionGroup: clear, createOptionHash, resolveSelectedOptions } = require("../lib/cart/options.ts");
const option = (id, group_id, is_active = true) => ({ id, group_id, is_active, option_name: id, additional_price: 5000 });
const toppings = { id: "toppings", menu_item_id: "dish", name: "Topping", is_active: true, is_multiple: true, is_required: false,
  options: [option("pearl", "toppings"), option("jelly", "toppings"), option("inactive", "toppings", false)] };
const sugar = { id: "sugar", menu_item_id: "dish", name: "Sugar", is_active: true, is_multiple: false, is_required: true,
  options: [option("sugar-50", "sugar"), option("sugar-70", "sugar")] };
const original = [];
let selected = toggle(original, toppings, "pearl");
assert.deepEqual(original, [], "State updater does not mutate old state");
assert.deepEqual(selected, [{ option_id: "pearl" }]);
selected = toggle(selected, toppings, "jelly");
assert.equal(selected.length, 2, "Multiple topping choices are kept");
selected = toggle(selected, sugar, "sugar-50");
selected = toggle(selected, sugar, "sugar-70");
assert.deepEqual(selected, [{ option_id: "jelly" }, { option_id: "pearl" }, { option_id: "sugar-70" }]);
assert.equal(toggle(selected, sugar, "sugar-70").length, 3, "Radio choice never duplicates");
assert.deepEqual(toggle(selected, toppings, "inactive"), selected);
assert.deepEqual(toggle(selected, toppings, "sugar-50"), selected, "Cannot select an option from another group");
assert.deepEqual(toggle(selected, { ...toppings, is_active: false }, "pearl"), selected);
const resolved = resolveSelectedOptions({ id: "dish", option_groups: [toppings, sugar] }, selected);
assert.equal(resolved.length, 3);
assert.equal(resolved.reduce((total, item) => total + item.additional_price, 0), 15000);
assert.deepEqual(resolved.map((item) => item.option_id).sort(), selected.map((item) => item.option_id).sort());
assert.equal(createOptionHash(selected), createOptionHash([...selected].reverse()));
selected = toggle(selected, toppings, "pearl");
assert.deepEqual(selected, [{ option_id: "jelly" }, { option_id: "sugar-70" }]);
assert.deepEqual(clear(selected, toppings), [{ option_id: "sugar-70" }], "Clear group preserves other groups");
assert.throws(() => resolveSelectedOptions({ id: "dish", option_groups: [sugar] }, []), /Vui lòng chọn/);
console.log("PASS: option_id state, multi/single selection, deselection, validity, prices and stable option hash");
