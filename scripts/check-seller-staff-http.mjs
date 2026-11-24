// Real local HTTP smoke only, no session/cookie/test accounts; cannot write DB.
// Run against the local Next server. This is not authenticated Supabase integration.
const base = new URL(process.argv[2] || "http://127.0.0.1:3104");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("LOCAL_SERVER_ONLY");
const id = "11111111-1111-4111-8111-111111111111";
const routes = [
  ["POST", "/api/seller/register"], ["PATCH", `/api/seller/restaurants/${id}`],
  ["POST", `/api/seller/restaurants/${id}/banks`], ["PATCH", `/api/seller/restaurants/${id}/banks/${id}`],
  ["POST", `/api/seller/restaurants/${id}/staff-qr`], ["POST", "/api/staff/join"],
  ["POST", `/api/orders/${id}/accept`],
];
async function run() {
  let failed = 0;
  for (const [method, path] of routes) {
    for (const [origin, expected] of [[base.origin, 401], ["https://outside.invalid", 403]]) {
      try {
        const response = await fetch(new URL(path, base), { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(45000) });
        const passed = response.status === expected && response.headers.get("cache-control") === "no-store";
        if (!passed) failed++;
        console.log(JSON.stringify({ method, path, scenario: expected === 401 ? "no-session" : "foreign-origin", status: response.status, expected, passed }));
        // Never dump body, headers, tokens or credentials on failure.
        await response.body?.cancel();
      } catch { failed++; console.log(JSON.stringify({ method, path, scenario: "http", passed: false, error: "REQUEST_FAILED" })); }
    }
  }
  for (const path of ["/api/staff/join", `/api/seller/restaurants/${id}/staff-qr`]) {
    try {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(45000) });
      const passed = response.status === 405; if (!passed) failed++;
      console.log(JSON.stringify({ method: "GET", path, status: response.status, expected: 405, passed }));
      await response.body?.cancel();
    } catch { failed++; console.log(JSON.stringify({ method: "GET", path, passed: false, error: "REQUEST_FAILED" })); }
  }
  console.log(JSON.stringify({ realLocalHttpChecks: 16, failures: failed, authenticatedDatabaseIntegration: false }));
  process.exitCode = failed ? 1 : 0;
}
run().catch(() => { console.log("HTTP_SMOKE_FAILED_NO_PRIVATE_OUTPUT"); process.exitCode = 1; });
