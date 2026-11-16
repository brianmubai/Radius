import * as assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';

export function expect(actual: any) {
  const matcher = {
    toBe: (expected: any) => assert.strictEqual(actual, expected),
    toEqual: (expected: any) => assert.deepStrictEqual(actual, expected),
    toBeGreaterThan: (expected: number) => assert.ok(actual > expected, `Expected ${actual} > ${expected}`),
    toBeGreaterThanOrEqual: (expected: number) => assert.ok(actual >= expected, `Expected ${actual} >= ${expected}`),
    toBeLessThan: (expected: number) => assert.ok(actual < expected, `Expected ${actual} < ${expected}`),
    toBeLessThanOrEqual: (expected: number) => assert.ok(actual <= expected, `Expected ${actual} <= ${expected}`),
    toBeCloseTo: (expected: number, delta: number = 0.05) => {
      const diff = Math.abs(actual - expected);
      assert.ok(diff <= delta, `Expected ${actual} to be close to ${expected} (diff: ${diff} > ${delta})`);
    },
    toThrow: (errorMatcher?: any) => {
      if (typeof errorMatcher === 'string') {
        assert.throws(actual, new RegExp(errorMatcher.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      } else {
        assert.throws(actual, errorMatcher);
      }
    },
    toBeDefined: () => assert.ok(actual !== undefined, `Expected value to be defined`),
    toBeUndefined: () => assert.strictEqual(actual, undefined),
    toBeNull: () => assert.strictEqual(actual, null),
    toBeTruthy: () => assert.ok(Boolean(actual)),
    toBeFalsy: () => assert.ok(!Boolean(actual)),
    not: {
      toBe: (expected: any) => assert.notStrictEqual(actual, expected),
      toEqual: (expected: any) => assert.notDeepStrictEqual(actual, expected),
      toThrow: () => assert.doesNotThrow(actual),
    },
  };
  return matcher;
}

export { describe, it, beforeEach };
