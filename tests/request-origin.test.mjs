import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/http/request-origin.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, URL });
const { isSameOrigin } = exports;
function request(origin, host, extra = {}) {
  const headers = { ...extra };
  if (origin !== undefined) headers.origin = origin;
  if (host !== undefined) headers.host = host;
  return new Request("http://localhost:3104/api/staff/join", { headers });
}
test("accepts actual HTTP Host when Next normalized request.url", () => {
  assert.equal(isSameOrigin(request("http://127.0.0.1:3104", "127.0.0.1:3104")), true);
  assert.equal(isSameOrigin(request("http://localhost:3104", "127.0.0.1:3104")), false);
});
test("origin comparisons remain scheme/port aware and reject forwarded-host spoofing", () => {
  for (const origin of [undefined, "null", "", "http://evil.invalid", "http://localhost:444", "https://localhost:3104", "http://localhost:3104/path", "http://localhost:3104.evil.invalid"]) {
    assert.equal(isSameOrigin(request(origin, "localhost:3104", { "x-forwarded-host": "evil.invalid" })), false);
  }
  assert.equal(isSameOrigin(request("http://evil.invalid", "localhost:3104", { "x-forwarded-host": "evil.invalid" })), false);
  assert.equal(isSameOrigin(request("http://localhost:3104", undefined)), true);
});
test("rejects malformed Host; handles normal default port and IPv6", () => {
  for (const host of ["a,b", "localhost:3104/path", "user@localhost:3104", "", "[", "localhost:3104?x=1"]) {
    assert.equal(isSameOrigin(request("http://localhost:3104", host)), false);
  }
  assert.equal(isSameOrigin(request("http://example.com", "example.com:80")), true);
  assert.equal(isSameOrigin(request("http://[::1]:3104", "[::1]:3104")), true);
});
