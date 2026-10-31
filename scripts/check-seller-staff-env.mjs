// Read-only remote preflight. Only --configure-secret writes an ignored local key.
// Never dump env, response bodies, credentials or network error messages.
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import nextEnv from "@next/env";
const inherited = { ...process.env };
const envMode = process.argv.includes("--production") ? false : true;
const loaded = nextEnv.loadEnvConfig(process.cwd(), envMode, { info() {}, error() { console.log("ENV_LOAD_ERROR"); } });

async function main() {
  const key = process.env.STAFF_INVITATION_SECRET;
  if (process.argv.includes("--configure-secret") && !key?.trim()) {
    execFileSync("git", ["check-ignore", "--quiet", ".env.local"], { stdio: "ignore" });
    const generated = crypto.randomBytes(32).toString("base64url");
    fs.appendFileSync(".env.local", `\n# Local staff QR signing key, generated with node:crypto; never commit.\nSTAFF_INVITATION_SECRET="${generated}"\n`, { mode: 0o600 });
    process.env.STAFF_INVITATION_SECRET = generated;
    console.log("STAFF_INVITATION_SECRET_CREATED_IN_IGNORED_ENV_LOCAL");
  } else if (process.argv.includes("--configure-secret")) {
    console.log("EXISTING_STAFF_INVITATION_SECRET_PRESERVED");
  }
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "STAFF_INVITATION_SECRET"]) {
    const local = loaded.loadedEnvFiles.find((file) => file.path === ".env.local")?.env;
    const fileSource = loaded.loadedEnvFiles.find((file) => Object.hasOwn(file.env, name));
    console.log(JSON.stringify({ name, configured: !!process.env[name]?.trim(),
      localEntryPresent: !!local && Object.hasOwn(local, name),
      source: Object.hasOwn(inherited, name) ? "inherited-process" : fileSource?.path ?? "absent",
      localMatchesEffective: local && Object.hasOwn(local, name) ? local[name] === process.env[name] : null }));
  }
  console.log(JSON.stringify({ envMode: envMode ? "development" : "production", loadedFiles: loaded.loadedEnvFiles.map((file) => file.path) }));
  let databaseFormatValid = false;
  const database = process.env.DATABASE_URL?.trim();
  const databasePlaceholder = !!database && /DB_USER|DB_PASSWORD|DB_HOST|DB_NAME|YOUR[_-]|REPLACE|<[^>]+>/i.test(database);
  try { const url = new URL(database); databaseFormatValid = ["postgres:", "postgresql:"].includes(url.protocol) && !!url.hostname && !!url.username; } catch { /* Only report flags. */ }
  console.log(JSON.stringify({ databaseFormatValid, databasePlaceholder }));
  let base;
  try { base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL); } catch { /* Only report flags. */ }
  const projectRef = base?.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const keyKind = anon?.startsWith("sb_publishable_") ? "publishable" : anon?.split(".").length === 3 ? "legacy-jwt" : "unknown";
  let jwtPayload;
  try { if (keyKind === "legacy-jwt") jwtPayload = JSON.parse(Buffer.from(anon.split(".")[1], "base64url").toString()); } catch { /* Do not print payload. */ }
  console.log(JSON.stringify({ supabaseUrlFormatValid: base?.protocol === "https:" && !!projectRef && base.pathname === "/" && !base.username && !base.password && !base.search && !base.hash,
    keyKind, jwtPayloadReadable: !!jwtPayload,
    jwtRoleIsAnon: jwtPayload ? jwtPayload.role === "anon" : null,
    jwtProjectMatchesUrl: jwtPayload?.ref && projectRef ? jwtPayload.ref === projectRef : null,
    jwtExpired: typeof jwtPayload?.exp === "number" ? jwtPayload.exp <= Date.now() / 1000 : null,
    keyPlaceholder: !!anon && /YOUR[_-]|REPLACE|PLACEHOLDER/i.test(anon),
    requestHeaders: keyKind === "legacy-jwt" ? ["apikey", "Authorization: Bearer <anon JWT>"] : ["apikey"],
    note: "JWT claims are not signature verification; publishable key project requires server verification" }));
  if (!process.argv.includes("--remote-metadata")) return;
  if (!base || base.protocol !== "https:") throw new Error("INVALID_PROJECT_URL");
  if (!anon) throw new Error("ANON_KEY_MISSING");
  if (keyKind === "unknown" || (jwtPayload && jwtPayload.role !== "anon")) throw new Error("PUBLIC_KEY_TYPE_INVALID");
  const headers = { apikey: anon };
  // Legacy anon JWT needs Authorization too; publishable keys are not JWTs.
  if (anon.split(".").length === 3) headers.Authorization = `Bearer ${anon}`;
  for (const [path, kind] of [["/auth/v1/settings", "auth-settings"], ["/rest/v1/", "openapi-metadata"]]) {
    try {
      const response = await fetch(new URL(path, base), {
        headers: { ...headers, ...(kind === "openapi-metadata" ? { Accept: "application/openapi+json" } : {}) },
        signal: AbortSignal.timeout(15000), redirect: "error",
      });
      console.log(JSON.stringify({ kind, status: response.status }));
      if (!response.ok) {
        let detail;
        try { detail = await response.json(); } catch { detail = {}; }
        const code = typeof detail.code === "string" && /^[A-Z0-9_]{1,32}$/.test(detail.code) ? detail.code : "UNAVAILABLE";
        const message = String(detail.message || detail.error_description || "");
        const reason = /JWT expired/i.test(message) ? "JWT_EXPIRED" : /invalid api key/i.test(message) ? "API_KEY_INVALID"
          : /signature/i.test(message) ? "JWT_SIGNATURE_INVALID" : "AUTH_OR_ACCESS_NOT_VERIFIED";
        console.log(JSON.stringify({ kind, code, reason }));
        continue;
      }
      const data = await response.json();
      if (kind === "openapi-metadata") {
        const definitions = data.definitions || data.components?.schemas || {};
        console.log(JSON.stringify({ visibleRpcNames: Object.keys(data.paths || {}).filter((p) => p.startsWith("/rpc/")) }));
        for (const table of ["users", "restaurants", "restaurant_banks", "orders", "carts", "cart_items"]) {
          const schema = definitions[table];
          console.log(JSON.stringify({ table, visibleMetadata: !!schema, columns: Object.keys(schema?.properties || {}) }));
        }
        console.log("OPENAPI_IS_NOT_POLICY_RPC_DEFINITION_OR_PRIVILEGE_VERIFICATION");
      } else {
        console.log(JSON.stringify({ authSettingsReadable: true, signupDisabled: data.disable_signup ?? null }));
      }
    } catch (error) {
      console.log(JSON.stringify({ kind, networkError: ["ENOTFOUND", "EACCES", "ECONNREFUSED", "ETIMEDOUT"].includes(error.cause?.code) ? error.cause.code : "REQUEST_FAILED" }));
    }
  }
}
main().catch(() => { console.log("PREFLIGHT_FAILED_NO_SECRETS_LOGGED"); process.exitCode = 1; });
