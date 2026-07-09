import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreColor } from '../src/lib/score-color'

test('scoreColor: default thresholds classify good/ok/bad on a 0-100 scale', () => {
  assert.equal(scoreColor(70), 'text-green-600 dark:text-green-400')
  assert.equal(scoreColor(50), 'text-yellow-600 dark:text-yellow-400')
  assert.equal(scoreColor(49), 'text-red-500 dark:text-red-400')
})

test('scoreColor: null value returns the default empty class', () => {
  assert.equal(scoreColor(null), 'text-fg/30')
})

test('scoreColor: custom emptyClass overrides the default', () => {
  assert.equal(scoreColor(null, { emptyClass: 'text-fg/40' }), 'text-fg/40')
})

test('scoreColor: custom thresholds work on non-100 scales (e.g. 0-10)', () => {
  assert.equal(scoreColor(8, { thresholds: { good: 8, ok: 6 } }), 'text-green-600 dark:text-green-400')
  assert.equal(scoreColor(6, { thresholds: { good: 8, ok: 6 } }), 'text-yellow-600 dark:text-yellow-400')
  assert.equal(scoreColor(5, { thresholds: { good: 8, ok: 6 } }), 'text-red-500 dark:text-red-400')
})

test('scoreColor: custom palette overrides the default classes', () => {
  const palette = { good: 'bg-green-50 text-green-700', ok: 'bg-yellow-50 text-yellow-700', bad: 'bg-red-50 text-red-600' }
  assert.equal(scoreColor(80, { palette }), 'bg-green-50 text-green-700')
})

test('scoreColor: equal good/ok thresholds collapse to a 2-tier good/bad split', () => {
  const opts = { thresholds: { good: 70, ok: 70 } }
  assert.equal(scoreColor(70, opts), 'text-green-600 dark:text-green-400')
  assert.equal(scoreColor(69, opts), 'text-red-500 dark:text-red-400')
})

test('scoreColor: fractional thresholds (0-1 scale) work unchanged', () => {
  const opts = { thresholds: { good: 0.7, ok: 0.5 } }
  assert.equal(scoreColor(0.75, opts), 'text-green-600 dark:text-green-400')
  assert.equal(scoreColor(0.55, opts), 'text-yellow-600 dark:text-yellow-400')
  assert.equal(scoreColor(0.3, opts), 'text-red-500 dark:text-red-400')
})
