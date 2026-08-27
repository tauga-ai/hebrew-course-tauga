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

test('isPendingQuestion: true for practice too, since placement recycling happens in the 30-minute session', () => {
  // Widened by naale-placement-question-recycling. The soft stop did NOT
  // widen with it — session/answer and session/open-answer each check
  // kind === 'topic' themselves, so the 30-minute session keeps its hard
  // stop at expiry. See the guard test below.
  assert.equal(isPendingQuestion({ kind: 'practice', pending_question_id: 'q1' }, 'q1'), true)
})

test('isPendingQuestion: always false for placement, which must never re-serve a question', () => {
  // Placement samples a student cold to find their level; showing them a
  // question they have already answered would corrupt the level it produces.
  assert.equal(isPendingQuestion({ kind: 'placement', pending_question_id: 'q1' }, 'q1'), false)
})

test('the soft stop stays topic-only even though isPendingQuestion widened', () => {
  // Mirrors the condition in session/answer/route.ts and
  // session/open-answer/route.ts. This is the regression guard for the
  // widening: a 30-minute session must never accept an answer after expiry,
  // even for the question it last served.
  const softStopEligible = (session: { kind: string; pending_question_id: string | null }) =>
    session.kind === 'topic' && isPendingQuestion(session, 'q1')

  assert.equal(softStopEligible({ kind: 'topic', pending_question_id: 'q1' }), true)
  assert.equal(softStopEligible({ kind: 'practice', pending_question_id: 'q1' }), false)
  assert.equal(softStopEligible({ kind: 'placement', pending_question_id: 'q1' }), false)
})

test('placement answers split out of the seen set; non-placement answers win', () => {
  // Mirrors the partition in session/next/route.ts. A question answered in
  // placement AND later in practice is genuinely seen and must NOT come back
  // through the reclaim tier.
  const placementSessionIds = new Set(['p1'])
  const answers = [
    { question_id: 'q-placement-only', session_id: 'p1', answered_at: '2026-08-01T10:00:00Z' },
    { question_id: 'q-both', session_id: 'p1', answered_at: '2026-08-01T10:00:00Z' },
    { question_id: 'q-both', session_id: 's1', answered_at: '2026-08-05T10:00:00Z' },
  ]

  const seenIds = new Set<string>()
  const placementFirstSeen = new Map<string, string>()
  for (const a of answers) {
    if (placementSessionIds.has(a.session_id)) {
      const existing = placementFirstSeen.get(a.question_id)
      if (!existing || a.answered_at < existing) placementFirstSeen.set(a.question_id, a.answered_at)
    } else {
      seenIds.add(a.question_id)
    }
  }
  const placementOnly = [...placementFirstSeen]
    .filter(([id]) => !seenIds.has(id))
    .map(([id]) => id)

  assert.deepEqual(placementOnly, ['q-placement-only'])
  assert.ok(seenIds.has('q-both'))
})

test('reclaimed placement questions come back oldest-answered first', () => {
  const placementFirstSeen = new Map([
    ['q-new', '2026-08-20T10:00:00Z'],
    ['q-old', '2026-08-01T10:00:00Z'],
  ])
  const ordered = [...placementFirstSeen].sort((a, b) => (a[1] < b[1] ? -1 : 1)).map(([id]) => id)
  assert.deepEqual(ordered, ['q-old', 'q-new'])
})

test('an unseen question always beats a reclaimed placement one', () => {
  // Pass 1 excludes both seen and placement-only ids; pass 2 is only reached
  // when pass 1 found nothing anywhere on the ladder.
  const bank = [
    { id: 'q-unseen', difficulty: 3 },
    { id: 'q-placement', difficulty: 3 },
  ]
  const seenIds = new Set<string>()
  const placementOnlyIds = new Set(['q-placement'])

  const pass1 = bank.filter(q => !seenIds.has(q.id) && !placementOnlyIds.has(q.id))
  assert.deepEqual(pass1.map(q => q.id), ['q-unseen'])
})

test('secondsRemaining: never negative', () => {
  assert.equal(secondsRemaining(iso(30_000), NOW), 30)
  assert.equal(secondsRemaining(iso(-90_000), NOW), 0)
})
