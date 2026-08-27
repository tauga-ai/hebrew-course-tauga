import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSessionCompleted, isExpired, secondsRemaining, MIN_ANSWERS_FOR_COMPLETION, isPendingQuestion } from '../src/lib/naale/session-rules'

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

test('isSessionCompleted: a session that closes just short of its deadline still completes', () => {
  // Deadline technically 900ms in the future (ordinary client/server
  // drift, matching the 904ms gap observed in production) → still
  // completed, unlike a naive "deadline <= now" check.
  assert.equal(isSessionCompleted(iso(900), 28, NOW), true)
  // Was asserted false when the grace window was 2s. Flipped deliberately
  // on 2026-08-24 — real sessions were measured closing ~5.5s short
  // (2db627c0: 5.702s, 0938c20d: 5.312s) and being denied completion
  // despite the student sitting through the whole timer. Not a drifted
  // expectation: see TIMER_GRACE_MS's own comment for why the window moved.
  assert.equal(isSessionCompleted(iso(3000), 28, NOW), true)
  // The real gap this was raised to cover.
  assert.equal(isSessionCompleted(iso(5702), 28, NOW), true)
  // The far edge. This is the guard against the window being widened again
  // until "quitting early" starts counting as finishing — if a future change
  // makes this pass, that change has gone too far.
  assert.equal(isSessionCompleted(iso(31_000), 28, NOW), false)
  // The answer minimum is untouched by any of this: still not completed
  // without it, however close to the deadline the session ran.
  assert.equal(isSessionCompleted(iso(3000), MIN_ANSWERS_FOR_COMPLETION - 1, NOW), false)
})

test('isExpired: true only once the deadline has passed', () => {
  assert.equal(isExpired(iso(1), NOW), false)
  assert.equal(isExpired(iso(0), NOW), true)
  assert.equal(isExpired(iso(-1), NOW), true)
})

test('isPendingQuestion: true only for a topic session asking about its own pending question', () => {
  assert.equal(isPendingQuestion({ kind: 'topic', pending_question_id: 'q1' }, 'q1'), true)
})

test('isPendingQuestion: false for a different question id, even in a topic session', () => {
  assert.equal(isPendingQuestion({ kind: 'topic', pending_question_id: 'q1' }, 'q2'), false)
})

test('isPendingQuestion: false with no pending question recorded', () => {
  assert.equal(isPendingQuestion({ kind: 'topic', pending_question_id: null }, 'q1'), false)
})

test('isPendingQuestion: false for practice/placement even with a matching id — soft stop and recycling are topic-only', () => {
  assert.equal(isPendingQuestion({ kind: 'practice', pending_question_id: 'q1' }, 'q1'), false)
  assert.equal(isPendingQuestion({ kind: 'placement', pending_question_id: 'q1' }, 'q1'), false)
})

test('secondsRemaining: never negative', () => {
  assert.equal(secondsRemaining(iso(30_000), NOW), 30)
  assert.equal(secondsRemaining(iso(-90_000), NOW), 0)
})
