/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const ts = require("typescript");
const assert = require("node:assert/strict");
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(outputText, filename);
};
const { createDebouncedSync } = require("../lib/cart/debounced-sync.ts");
function fakeClock() {
  let now = 0, id = 0;
  const timers = new Map();
  return {
    setTimeout(fn, delay) { const key = ++id; timers.set(key, { fn, at: now + delay }); return key; },
    clearTimeout(key) { timers.delete(key); },
    tick(ms) {
      now += ms;
      for (const [key, timer] of timers) {
        if (timer.at <= now) { timers.delete(key); timer.fn(); }
      }
    },
  };
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
async function main() {
  const calls = [];
  const clock = fakeClock();
  const sync = createDebouncedSync(async (value) => { calls.push(value); }, 700, clock);
  sync.enqueue([{ id: "a", quantity: 2 }]);
  clock.tick(500);
  sync.enqueue([{ id: "a", quantity: 3 }, { id: "b", quantity: 2 }]);
  clock.tick(699); await settle();
  assert.equal(calls.length, 0, "Each edit restarts the debounce window");
  clock.tick(1); await settle();
  assert.deepEqual(calls, [[{ id: "a", quantity: 3 }, { id: "b", quantity: 2 }]]);
  sync.enqueue([{ id: "a", quantity: 4 }]);
  sync.enqueue([]);
  await sync.flush();
  assert.deepEqual(calls[1], [], "Removal replaces the pending quantity update");
  assert.equal(calls.length, 2, "Flush sends immediately without waiting 700ms");

  let release;
  const serializedCalls = [];
  const serialized = createDebouncedSync((value) => {
    serializedCalls.push(value);
    return serializedCalls.length === 1 ? new Promise((resolve) => { release = resolve; }) : Promise.resolve();
  }, 700, fakeClock());
  serialized.enqueue(1);
  const flushed = serialized.flush();
  await settle();
  serialized.enqueue(2);
  assert.deepEqual(serializedCalls, [1]);
  release();
  await flushed;
  assert.deepEqual(serializedCalls, [1, 2], "Flush drains edits made during a request, in order");

  let rejectFirst;
  const failedCalls = [];
  const retry = createDebouncedSync((value) => {
    failedCalls.push(value);
    return failedCalls.length === 1 ? new Promise((_, reject) => { rejectFirst = reject; }) : Promise.resolve();
  }, 700, fakeClock());
  retry.enqueue(1);
  const failure = retry.flush();
  await settle();
  retry.enqueue(3);
  rejectFirst(new Error("offline"));
  await assert.rejects(failure, /offline/);
  await retry.flush();
  assert.deepEqual(failedCalls, [1, 3], "Failed old snapshot cannot overwrite a newer edit");

  let fail = true;
  const retained = [];
  const retain = createDebouncedSync(async (value) => {
    if (fail) throw new Error("offline");
    retained.push(value);
  }, 700, fakeClock());
  retain.enqueue(7);
  await assert.rejects(retain.flush(), /offline/);
  fail = false;
  await retain.flush();
  assert.deepEqual(retained, [7], "Failed snapshot is retained for retry");
  console.log("PASS: debounce timing, batching, removal, flush, serialized requests and failure recovery");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
