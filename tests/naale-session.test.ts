import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSessionCompleted, isExpired, secondsRemaining, MIN_ANSWERS_FOR_COMPLETION } from '../src/lib/naale/session-rules'

const NOW = 1_700_000_000_000
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

test('isSessionCompleted: needs BOTH the timer and the answer minimum', () => {
  // Timer reached, enough answers → completed.
  assert.equal(isSessionCompleted(iso(-1000), MIN_ANSWERS_FOR_COMPLETION, NOW), true)
  // Timer reached, too few answers → NOT completed.
  assert.equal(isSessionCompleted(iso(-1000), MIN_ANSWERS_FOR_COMPLETION - 1, NOW), false)
  // Plenty of answers but the timer hasn't run out → NOT completed.
  assert.equal(isSessionCompleted(iso(60_000), 50, NOW), false)
})

test('isSessionCompleted: small clock drift within the grace window still completes', () => {
  // Deadline technically 900ms in the future (ordinary client/server
  // drift, matching the 904ms gap observed in production) → still
  // completed, unlike a naive "deadline <= now" check.
  assert.equal(isSessionCompleted(iso(900), 28, NOW), true)
  // Comfortably outside the grace window → still correctly NOT completed.
  assert.equal(isSessionCompleted(iso(3000), 28, NOW), false)
})

test('isExpired: true only once the deadline has passed', () => {
  assert.equal(isExpired(iso(1), NOW), false)
  assert.equal(isExpired(iso(0), NOW), true)
  assert.equal(isExpired(iso(-1), NOW), true)
})

test('secondsRemaining: never negative', () => {
  assert.equal(secondsRemaining(iso(30_000), NOW), 30)
  assert.equal(secondsRemaining(iso(-90_000), NOW), 0)
})
