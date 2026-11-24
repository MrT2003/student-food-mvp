/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test runner uses the TypeScript require hook. */
// Install the existing TypeScript require hook and run the regression suite.
require('./test-seller-orders.cjs');
const assert = require('node:assert/strict');
const entries = new Map();
global.sessionStorage = {
  getItem: (key) => entries.get(key) ?? null,
  setItem: (key, value) => entries.set(key, value),
  removeItem: (key) => entries.delete(key),
};
const { useSellerPreviewStore } = require('../store/useSellerPreviewStore.ts');
const draft = { name: 'Quán mới', description: 'Món ngon', location: 'KTX B', cash: false, bank: true, hours: 'T2: 10:00 – 14:00' };
assert.equal(useSellerPreviewStore.getState().draft, null);
useSellerPreviewStore.getState().registerPreview(draft);
assert.deepEqual(useSellerPreviewStore.getState().draft, draft);
const key = 'student-food:seller-registration-preview:v1';
const saved = entries.get(key);
assert.deepEqual(JSON.parse(saved).state.draft, draft);
useSellerPreviewStore.setState({ draft: null });
entries.set(key, saved);
useSellerPreviewStore.persist.rehydrate();
assert.deepEqual(useSellerPreviewStore.getState().draft, draft);
assert.equal('role' in useSellerPreviewStore.getState(), false);
console.log('PASS seller registration preview preserves submitted fields and restores session without granting roles');
