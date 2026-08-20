/**
 * Browsing back through answered questions. An off-by-one here isn't cosmetic:
 * the live question is `null`, so a bad boundary either strands the student in
 * history with no way back to the question they're meant to be answering, or
 * silently drops the newest answered question out of reach.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canGoBack, goBack, goForward, isResolved } from '@/lib/naale/session-history'

test('from the live question, back lands on the most recent answered one', () => {
  assert.equal(canGoBack(null, 3), true)
  assert.equal(goBack(null, 3), 2)
})

test('back walks toward the oldest question and then stops', () => {
  assert.equal(goBack(2, 3), 1)
  assert.equal(goBack(1, 3), 0)
  assert.equal(canGoBack(0, 3), false)
  assert.equal(goBack(0, 3), 0, 'stays put rather than going negative')
})

test('with nothing answered yet there is nowhere to go back to', () => {
  assert.equal(canGoBack(null, 0), false)
  assert.equal(goBack(null, 0), null)
})

test('forward walks back toward the live question and lands on it', () => {
  assert.equal(goForward(0, 3), 1)
  assert.equal(goForward(1, 3), 2)
  assert.equal(goForward(2, 3), null, 'past the newest entry is the live question')
})

test('forward from the live question is a no-op, never index 0', () => {
  // Getting this wrong would jump a student to the OLDEST question when they
  // pressed forward on the one they were answering.
  assert.equal(goForward(null, 3), null)
})

test('only answered questions are eligible for history', () => {
  assert.equal(isResolved({ result: { is_correct: true }, openResult: null }), true)
  assert.equal(isResolved({ result: null, openResult: { score: 4 } }), true)
  assert.equal(isResolved({ result: null, openResult: null }), false)
})
