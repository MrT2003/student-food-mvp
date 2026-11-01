import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";

// Chạy service thật và helper thật; không cấp DB, network hoặc biến môi trường.
function load(file) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require(id) {
      if (id === "server-only") return {};
      if (id === "node:crypto") return crypto;
      if (id === "@/lib/database/server") return {
        DatabaseConfigurationError: class extends Error {},
        getDatabasePool() { throw new Error("Validation must not connect to DB"); },
      };
      if (id === "@/utilities/system.utility") return load("../utilities/system.utility.ts");
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return exports;
}

const { SellerServices } = load("../services/seller.service.ts");
const validate = (input) => SellerServices.validateRegistration(input);
const plain = (value) => JSON.parse(JSON.stringify(value));
const valid = (patch = {}) => ({
  name: "  Cơm sinh viên  ",
  description: "  Cơm trưa mỗi ngày  ",
  location: "  KTX A  ",
  cash: true,
  bank: false,
  scheduleMode: "same",
  openTime: "10:00",
  closeTime: "14:00",
  days: [
    { id: "mon", label: "T2", enabled: true, open: "10:00", close: "14:00" },
    { id: "tue", label: "T3", enabled: false, open: "", close: "" },
  ],
  startClosed: false,
  ...patch,
});

function rejects(input, field) {
  assert.throws(() => validate(input), (error) => {
    assert.match(error.message, /^SELLER_VALIDATION_ERROR:/);
    if (field) assert.ok(error.message.includes(`${field}:`), error.message);
    return true;
  });
}

test("same: trims text, returns only checked active fields and leaves input unchanged", () => {
  const input = valid();
  const before = structuredClone(input);
  const output = validate(input);
  assert.deepEqual(plain(output), {
    name: "Cơm sinh viên", description: "Cơm trưa mỗi ngày", location: "KTX A",
    cash: true, bank: false,
    schedule: { mode: "same", dayIds: ["mon"], openTime: "10:00", closeTime: "14:00" },
  });
  output.schedule.dayIds.push("fri");
  assert.deepEqual(input, before);
});

test("daily: only enabled days require hours; hidden same-hours values have no effect", () => {
  const output = validate(valid({ scheduleMode: "daily", openTime: "", closeTime: "" }));
  assert.deepEqual(plain(output.schedule), {
    mode: "daily", days: [{ id: "mon", open: "10:00", close: "14:00" }],
  });
});

test("later: days and hours are optional, including all-disabled or empty UI state", () => {
  for (const patch of [
    { days: undefined, openTime: undefined, closeTime: undefined },
    { days: [], openTime: "", closeTime: "" },
    { days: [{ id: "mon", enabled: false }] },
    {},
  ]) {
    assert.deepEqual(plain(validate(valid({ ...patch, scheduleMode: "later" })).schedule), { mode: "later" });
  }
});

test("no bank details, phone, image, slug or client identity are required", () => {
  const output = validate({
    name: "Quán", description: "Mô tả", location: "KTX B", cash: false, bank: true, scheduleMode: "later",
  });
  assert.equal(output.bank, true);
  assert.equal(output.schedule.mode, "later");
});

for (const input of [null, undefined, [], "json", 1, true]) {
  test(`rejects non-object payload: ${JSON.stringify(input)}`, () => rejects(input, "payload"));
}

for (const field of ["name", "description", "location", "cash", "bank", "scheduleMode", "days", "openTime", "closeTime"]) {
  test(`rejects missing required field in same mode: ${field}`, () => {
    const input = valid();
    delete input[field];
    rejects(input);
  });
}

for (const [field, max] of [["name", 100], ["description", 300], ["location", 200]]) {
  for (const value of [null, 12, true, {}, [], "", " \t\n ", "x".repeat(max + 1)]) {
    test(`rejects ${field} value ${JSON.stringify(value)}`, () => rejects(valid({ [field]: value }), field));
  }
  test(`accepts exact ${field} length limit`, () => {
    assert.equal(validate(valid({ [field]: "x".repeat(max) }))[field].length, max);
  });
  test(`checks ${field} length before trimming`, () => rejects(valid({ [field]: ` ${"x".repeat(max)} ` }), field));
}

for (const field of ["cash", "bank", "startClosed"]) {
  for (const value of [null, "true", "false", 0, 1, [], {}]) {
    test(`rejects non-boolean ${field}: ${JSON.stringify(value)}`, () => rejects(valid({ [field]: value }), field));
  }
}

for (const [cash, bank] of [[true, false], [false, true], [true, true]]) {
  test(`accepts payment selection ${cash}/${bank}`, () => {
    assert.equal(validate(valid({ cash, bank })).cash, cash);
  });
}
test("rejects no payment method", () => rejects(valid({ cash: false, bank: false }), "payment"));
test("startClosed cannot affect validated output", () => {
  assert.deepEqual(plain(validate(valid({ startClosed: true }))), plain(validate(valid({ startClosed: false }))));
  const input = valid();
  delete input.startClosed;
  assert.deepEqual(plain(validate(input)), plain(validate(valid())));
});

for (const scheduleMode of [null, true, 0, "", "weekly", "SAME", {}]) {
  test(`rejects scheduleMode ${JSON.stringify(scheduleMode)}`, () => rejects(valid({ scheduleMode }), "scheduleMode"));
}

for (const scheduleMode of ["same", "daily", "later"]) {
  for (const days of [null, {}, "mon", [null], [[]], [{}],
    [{ id: "holiday", enabled: true }], [{ id: 1, enabled: true }],
    [{ id: "mon", enabled: true }, { id: "mon", enabled: false }],
    [{ id: "mon" }], [{ id: "mon", enabled: "false" }], [{ id: "mon", enabled: null }],
    [{ id: "mon", enabled: false, label: 1 }], [{ id: "mon", enabled: false, open: null }],
    [{ id: "mon", enabled: false, close: [] }], [{ id: "mon", enabled: false, owner_id: "other" }],
    Array.from({ length: 8 }, () => ({ id: "mon", enabled: false })),
  ]) {
    test(`${scheduleMode} rejects invalid day structure ${JSON.stringify(days)}`, () => rejects(valid({ scheduleMode, days })));
  }
  for (const field of ["openTime", "closeTime"]) {
    test(`${scheduleMode} rejects non-string ${field} even when hidden`, () => rejects(valid({ scheduleMode, [field]: null }), field));
  }
}

for (const scheduleMode of ["same", "daily"]) {
  for (const days of [[], [{ id: "mon", enabled: false }]]) {
    test(`${scheduleMode} requires an enabled day ${JSON.stringify(days)}`, () => rejects(valid({ scheduleMode, days }), "days"));
  }
  for (const [open, close] of [
    [undefined, "14:00"], ["10:00", undefined], ["", "14:00"], [null, "14:00"],
    ["9:00", "14:00"], ["24:00", "25:00"], ["10:60", "14:00"],
    ["10:00:00", "14:00"], [" 10:00", "14:00"], ["10:00", "14:60"],
    ["14:00", "14:00"], ["23:00", "01:00"], ["14:00", "10:00"],
  ]) {
    test(`${scheduleMode} rejects time range ${open}/${close}`, () => {
      rejects(valid(scheduleMode === "same"
        ? { openTime: open, closeTime: close }
        : { scheduleMode, days: [{ id: "mon", enabled: true, open, close }] }));
    });
  }
}

test("accepts seven unique UI days and boundary hours", () => {
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    .map((id) => ({ id, enabled: true, open: "00:00", close: "23:59" }));
  assert.equal(validate(valid({ days })).schedule.dayIds.length, 7);
  assert.equal(validate(valid({ days, scheduleMode: "daily" })).schedule.days.length, 7);
});

for (const field of ["owner_id", "user_id", "role", "operating_status", "status", "slug", "delivery_token", "phone", "imageFile", "unexpected"]) {
  test(`rejects field outside contract: ${field}`, () => rejects(valid({ [field]: "untrusted" }), "payload"));
}
