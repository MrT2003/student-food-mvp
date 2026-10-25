import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(getRestaurantMenu) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL("../app/api/test_restaurant/restaurant/route.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require(id) {
    if (id === "@/services/restaurant.service") return { RestaurantService: { getRestaurantMenu } };
    if (id === "next/server") return { NextResponse: { json: (body, init) => Response.json(body, init) } };
    throw new Error(`Unexpected import: ${id}`);
  } });
  return (query) => exports.GET({ nextUrl: new URL(`http://localhost/api/test_restaurant/restaurant${query}`) });
}

test("static restaurant route rejects missing/blank slug before querying", async () => {
  const get = load(() => { throw new Error("Must not query"); });
  for (const query of ["", "?slugParam=%20%20"]) assert.equal((await get(query)).status, 400);
});
test("static restaurant route awaits menu for the requested slug and preserves data envelope", async () => {
  const data = { restaurant: { slug: "com-ngon" }, items: [{ id: "item" }] };
  const get = load(async (slug) => { assert.equal(slug, "com-ngon"); await Promise.resolve(); return data; });
  const response = await get("?slugParam=%20com-ngon%20");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data });
});
test("static restaurant route keeps failure response for missing restaurant", async () => {
  assert.equal((await load(async () => null)("?slugParam=missing")).status, 500);
});
test("static restaurant route catches rejected query without exposing database error", async () => {
  const response = await load(async () => { throw new Error("PRIVATE_DATABASE_DETAIL"); })("?slugParam=com-ngon");
  assert.equal(response.status, 500);
  assert.equal((await response.text()).includes("PRIVATE_DATABASE_DETAIL"), false);
});
