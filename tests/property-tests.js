'use strict';

/**
 * Property-based tests for the To-Do Life Dashboard.
 * Run with: node property-tests.js  (from the tests/ directory)
 *
 * Requires fast-check: npm install  (in the tests/ directory)
 */

const fc = require('fast-check');

/* ─── localStorage mock ────────────────────────────────────────────────────── */

/**
 * A simple in-memory mock of the browser localStorage API.
 * Resets between test runs by reassigning `store`.
 */
function makeLocalStorageMock() {
  let store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
}

/* ─── Storage module (inlined from js/app.js) ──────────────────────────────── */

/**
 * Creates a Storage module bound to the provided localStorage implementation.
 * This mirrors the Storage object in js/app.js exactly, but accepts an
 * injectable localStorage so it can run in Node.js without a browser.
 *
 * @param {object} ls - A localStorage-compatible object
 */
function makeStorage(ls) {
  return {
    save(key, value) {
      try {
        ls.setItem(key, JSON.stringify(value));
      } catch (_e) {
        // localStorage unavailable or quota exceeded — continue in-memory
      }
    },
    load(key, fallback) {
      try {
        const raw = ls.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (_e) {
        return fallback;
      }
    },
  };
}

/* ─── Arbitraries ──────────────────────────────────────────────────────────── */

const taskArbitrary = fc.record({
  id: fc.integer(),
  description: fc.string({ minLength: 1 }),
  completed: fc.boolean(),
  createdAt: fc.integer(),
});

const quickLinkArbitrary = fc.record({
  id: fc.integer(),
  label: fc.string({ minLength: 1 }),
  url: fc.webUrl(),
});

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ─── Property 11: localStorage round-trip preserves data ─────────────────── */

// Feature: todo-life-dashboard, Property 11: localStorage round-trip preserves data

console.log('Running Property 11: localStorage round-trip preserves data...');

// Test 1: round-trip for an array of Task objects
fc.assert(
  fc.property(fc.array(taskArbitrary), (tasks) => {
    const ls = makeLocalStorageMock();
    const Storage = makeStorage(ls);
    const key = 'tld_tasks';

    Storage.save(key, tasks);
    const loaded = Storage.load(key, []);

    return deepEqual(loaded, tasks);
  }),
  { numRuns: 100, verbose: false }
);

console.log('  ✓ Task array round-trip: PASSED');

// Test 2: round-trip for an array of QuickLink objects
fc.assert(
  fc.property(fc.array(quickLinkArbitrary), (links) => {
    const ls = makeLocalStorageMock();
    const Storage = makeStorage(ls);
    const key = 'tld_quicklinks';

    Storage.save(key, links);
    const loaded = Storage.load(key, []);

    return deepEqual(loaded, links);
  }),
  { numRuns: 100, verbose: false }
);

console.log('  ✓ QuickLink array round-trip: PASSED');

console.log('\nAll Property 11 tests passed.');
