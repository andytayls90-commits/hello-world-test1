import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_REFRESH_MS, bindTaskFilters, mountTracker, startAutoRefresh } from '../assets/tracker-app.mjs';

function fakeDocument(page = 'executive', source = undefined) {
  const root = { innerHTML: '', querySelectorAll: () => [] };
  return {
    body: { dataset: { page, ...(source ? { source } : {}) } },
    querySelector: (selector) => selector === '#tracker-root' ? root : null,
    root
  };
}

test('malformed or missing data renders UNKNOWN instead of stale content', async () => {
  const documentRef = fakeDocument('executive');
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await mountTracker(documentRef, fetchImpl);
  assert.match(documentRef.root.innerHTML, /Tracker state UNKNOWN/);
  assert.match(documentRef.root.innerHTML, /404/);
});

test('task filters hide non-matching task cards and set aria state', () => {
  const listeners = {};
  const buttons = ['all','active','complete'].map((filter) => ({
    dataset: { filter }, attrs: {},
    addEventListener: (_name, callback) => { listeners[filter] = callback; },
    setAttribute(name, value) { this.attrs[name] = value; }
  }));
  const tasks = ['IN_PROGRESS','COMPLETE','BLOCKED'].map((status) => ({ dataset: { status }, hidden: false }));
  const root = { querySelectorAll: (selector) => selector === '[data-filter]' ? buttons : tasks };
  bindTaskFilters(root);
  listeners.active();
  assert.deepEqual(tasks.map((task) => task.hidden), [false, true, true]);
  assert.equal(buttons[1].attrs['aria-pressed'], 'true');
});

test('auto refresh uses the fixed one-minute interval', () => {
  let capturedMs = null;
  const timer = startAutoRefresh(fakeDocument(), async () => ({ ok: false, status: 500 }), (_callback, ms) => {
    capturedMs = ms;
    return 99;
  });
  assert.equal(AUTO_REFRESH_MS, 60_000);
  assert.equal(capturedMs, 60_000);
  assert.equal(timer, 99);
});
