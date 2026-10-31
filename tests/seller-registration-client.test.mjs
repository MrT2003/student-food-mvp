import assert from "node:assert/strict";
import { test } from "node:test";
import { load, restaurantId, registration, testPin } from "./seller-sdk-fixture.mjs";

const success = { restaurant: { id: restaurantId, slug: "quan-test", operating_status: "closed" }, role: "seller", paymentSelectionPersisted: false };
function client(options = {}) {
  const calls = [];
  const helper = load("../lib/seller/register-client.ts", {
    "@/services/auth.service": { async getCurrentProfile() { calls.push("profile"); if (options.profileError) throw new Error("PRIVATE"); return { role: options.profileRole ?? "seller", status: "active" }; } },
    "@/store/useAuthStore": { useAuthStore: { getState: () => ({ setUser: (profile) => calls.push({ profile }) }) } },
  }, { fetch: async (path, request) => {
    calls.push({ path, request });
    if (options.networkError) throw new Error("PRIVATE");
    if (options.fetch) return options.fetch();
    return Response.json(options.body ?? success, { status: options.status ?? 201 });
  } });
  return { ...helper, calls };
}
test("client submits JSON to API then refreshes profile/store (mock HTTP)", async () => {
  const f = client(); const input = registration();
  const result = await f.submitSellerRegistration(input);
  assert.equal(f.calls[0].path, "/api/seller/register");
  assert.equal(f.calls[0].request.credentials, "same-origin");
  const { appLockPin: pin, ...sent } = JSON.parse(f.calls[0].request.body);
  const { appLockPin: expected, ...safeInput } = input;
  assert.equal(pin === expected, true);
  assert.deepEqual(sent, safeInput);
  assert.equal(f.calls[1], "profile"); assert.equal(f.calls[2].profile.role, "seller");
  assert.equal(result.paymentSelectionPersisted, false);
});
test("client never refreshes profile or reports success after API/RLS/RPC error", async () => {
  for (const [code, status] of [["REGISTRATION_RPC_UNAVAILABLE", 503], ["REGISTRATION_RESULT_UNKNOWN", 503], ["DATABASE_ACCESS_DENIED", 403], ["UNAUTHORIZED", 401], ["ROLE_CONFLICT", 409], ["UNKNOWN", 500]]) {
    const f = client({ status, body: { error: { code, message: "PRIVATE_DATABASE_ERROR" } } });
    await assert.rejects(f.submitSellerRegistration(registration()), (error) => !error.message.includes("PRIVATE"));
    assert.equal(f.calls.length, 1);
  }
});
test("client treats network/invalid response and post-commit profile failure as uncertain; never fakes seller profile", async () => {
  for (const options of [{ networkError: true }, { body: {} }, { body: { ...success, paymentSelectionPersisted: true } }, { profileError: true }, { profileRole: "student" }]) {
    const f = client(options);
    await assert.rejects(f.submitSellerRegistration(registration()), (error) => !error.message.includes("PRIVATE"));
    assert.ok(!f.calls.some((call) => typeof call === "object" && call.profile));
  }
});

function formHarness(helper, uploadImage = async () => ({ secureUrl: "https://res.cloudinary.com/test/image/upload/test.png" })) {
  const states = [], refs = [], navigation = [];
  let stateCursor = 0, refCursor = 0;
  const jsx = (type, props) => ({ type, props });
  const { default: Component } = load("../components/features/seller/SellerRegistrationView.tsx", {
    react: {
      useState(initial) { const index = stateCursor++; if (!(index in states)) states[index] = initial; return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; },
      useRef(initial) { const index = refCursor++; return refs[index] ?? (refs[index] = { current: initial }); }, useEffect() {},
    },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": { default: "a" },
    "next/navigation": { useRouter: () => ({ push: (path) => navigation.push(path), refresh: () => navigation.push("refresh") }) },
    "lucide-react": {}, "@/styles/seller-registration.module.css": { default: {} }, "@/lib/seller/register-client": helper,
    "@/services/cloudinary.service": { CloudinaryService: { uploadImage } },
  });
  const render = () => { stateCursor = 0; refCursor = 0; return Component(); };
  function nodes(node) { if (!node || typeof node !== "object") return []; return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]; }
  let tree = render();
  for (const [id, value] of [["shop-name", "TEST"], ["shop-description", "TEST ONLY"], ["shop-location", "KTX TEST"], ["seller-app-lock-pin", testPin()]]) {
    nodes(tree).find((node) => node.props?.id === id).props.onChange({ target: { value } }); tree = render();
  }
  return { render, navigation, nodes, submit: () => nodes(render()).find((node) => node.type === "form").props.onSubmit({ preventDefault() {} }) };
}
test("actual form waits for API, prevents duplicate submit, displays failure and never navigates to preview", async () => {
  let resolve;
  const f = client({ fetch: () => new Promise((done) => { resolve = done; }) });
  const ui = formHarness(f);
  const running = ui.submit(); await ui.submit();
  assert.equal(f.calls.length, 1);
  assert.equal(ui.nodes(ui.render()).find((node) => node.props?.type === "submit").props.disabled, true);
  resolve(Response.json({ error: { code: "REGISTRATION_RPC_UNAVAILABLE" } }, { status: 503 })); await running;
  assert.deepEqual(ui.navigation, []);
  const tree = ui.render();
  assert.ok(ui.nodes(tree).some((node) => node.props?.role === "alert"));
  assert.equal(ui.nodes(tree).find((node) => node.props?.type === "submit").props.disabled, false);
  assert.equal(ui.nodes(tree).find((node) => node.props?.id === "seller-app-lock-pin").props.value === "", true);
});
test("actual form navigates only after successful API and confirmed seller profile (mock HTTP)", async () => {
  const f = client(); const ui = formHarness(f); await ui.submit();
  assert.equal(f.calls[1], "profile"); assert.deepEqual(ui.navigation, ["/seller", "refresh"]);
});

test("merged form keeps Cloudinary upload and blocks registration until upload completes", async () => {
  let resolveUpload;
  const f = client();
  const ui = formHarness(f, () => new Promise((resolve) => { resolveUpload = resolve; }));
  const image = ui.nodes(ui.render()).find((node) => node.props?.id === "shop-image");
  image.props.onChange({ target: { files: [{ type: "image/webp" }], value: "" } });
  assert.equal(ui.nodes(ui.render()).find((node) => node.props?.type === "submit").props.disabled, true);
  await ui.submit();
  assert.equal(f.calls.length, 0);
  resolveUpload({ secureUrl: "https://res.cloudinary.com/test/image/upload/test.webp" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.nodes(ui.render()).find((node) => node.props?.type === "submit").props.disabled, false);
  await ui.submit();
  assert.deepEqual(ui.navigation, ["/seller", "refresh"]);
  // Upload UI không đưa field ảnh ngoài contract vào RPC đăng ký hiện có.
  assert.equal(Object.hasOwn(JSON.parse(f.calls[0].request.body), "avatar_url"), false);
});
