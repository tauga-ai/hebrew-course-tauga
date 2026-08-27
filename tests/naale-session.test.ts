import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSessionCompleted, isExpired, isSessionExpired, secondsRemaining, MIN_ANSWERS_FOR_COMPLETION, isPendingQuestion, canPause, isPaused, remainingToBank, resumedDeadline, remainingMs } from '../src/lib/naale/session-rules'

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

// --- naale-topic-session-resume ---------------------------------------------

test('canPause: topic sessions only — the 30-minute session must never pause', () => {
  // The gate the whole feature hangs off. A future decision to allow 30-minute
  // pausing is a deliberate change to canPause(), never an accident elsewhere:
  // pausing a 30-minute session would let a student spread one sitting across a
  // day and still earn streak credit.
  assert.equal(canPause({ kind: 'topic' }), true)
  assert.equal(canPause({ kind: 'practice' }), false)
  assert.equal(canPause({ kind: 'placement' }), false)
})

test('isPaused: zero remaining still counts as paused', () => {
  // The obvious bug this guards: 0 is falsy, so a truthiness check would report
  // a session paused with no time left as running — and its stale deadline_at
  // would then be trusted.
  assert.equal(isPaused({ paused_remaining_ms: 0 }), true)
  assert.equal(isPaused({ paused_remaining_ms: 1000 }), true)
  assert.equal(isPaused({ paused_remaining_ms: null }), false)
})

test('remainingToBank: never negative', () => {
  assert.equal(remainingToBank(iso(30_000), NOW), 30_000)
  // Paused after the deadline had already passed — resumes as immediately
  // over, not with negative time.
  assert.equal(remainingToBank(iso(-5_000), NOW), 0)
})

test('resumedDeadline: the clock restarts from what was banked', () => {
  assert.equal(resumedDeadline(90_000, NOW), new Date(NOW + 90_000).toISOString())
  // A student who resumes with nothing left gets a deadline of now, not the past.
  assert.equal(resumedDeadline(-1, NOW), new Date(NOW).toISOString())
})

test('remainingMs: reads the banked value when paused, the deadline when running', () => {
  // The point of this helper: a paused session's deadline_at is frozen in the
  // past, so reading it directly would report 0 for a session that still has
  // three minutes owed to it.
  assert.equal(
    remainingMs({ deadline_at: iso(-600_000), paused_remaining_ms: 180_000 }, NOW),
    180_000
  )
  assert.equal(
    remainingMs({ deadline_at: iso(45_000), paused_remaining_ms: null }, NOW),
    45_000
  )
})

test('the stale-session sweep skips paused sessions', () => {
  // Mirrors the guard in session/start/route.ts. THE regression test for this
  // ticket: a paused session's deadline is in the past by construction, so
  // without the skip the sweep closes exactly the sessions resume exists to
  // preserve — silently, with no error to trace.
  const sweepWouldClose = (s: { deadline_at: string; paused_remaining_ms: number | null }) =>
    s.paused_remaining_ms === null && isExpired(s.deadline_at, NOW)

  assert.equal(
    sweepWouldClose({ deadline_at: iso(-600_000), paused_remaining_ms: 180_000 }),
    false,
    'a paused session must survive the sweep despite its past deadline'
  )
  assert.equal(
    sweepWouldClose({ deadline_at: iso(-600_000), paused_remaining_ms: null }),
    true,
    'a genuinely abandoned session is still closed'
  )
  assert.equal(
    sweepWouldClose({ deadline_at: iso(60_000), paused_remaining_ms: null }),
    false,
    'a live session is untouched'
  )
})

test('a paused session survives a round trip with the time it was owed', () => {
  // End to end through the pure helpers: 3:12 left, student leaves, comes back
  // ten minutes later, resumes.
  const banked = remainingToBank(iso(192_000), NOW)
  assert.equal(banked, 192_000)

  const LATER = NOW + 600_000
  const deadline = resumedDeadline(banked, LATER)
  assert.equal(secondsRemaining(deadline, LATER), 192)
  assert.equal(isExpired(deadline, LATER), false)
})

test('a paused session is not expired, however far its deadline has slipped', () => {
  // The trap behind session/status: a paused session's deadline_at is frozen
  // in the PAST by construction, so isExpired() reads true for every one of
  // them. /status reported that raw, and the session page believes /status —
  // boot calls finishSession('time_up') on an expired session. Net effect: any
  // boot onto a paused session (a reload, or arriving from Continue) ended the
  // very session the pause existed to preserve, and the banked time was gone.
  //
  // The remainder is the truth for a paused session; the clock is not.
  const longAgo = { deadline_at: iso(-3_600_000), paused_remaining_ms: 20_000 }

  assert.equal(isExpired(longAgo.deadline_at), true, 'the frozen clock does read as expired')
  assert.equal(isPaused(longAgo), true)
  assert.equal(remainingMs(longAgo, NOW), 20_000, 'but 20s were banked and are still owed')
})

test('remainingToBank floors at zero rather than banking a negative', () => {
  // A session whose timer ran out while the tab was already hidden banks 0,
  // not a negative — resumedDeadline() would otherwise hand back a deadline in
  // the past and the session would expire the instant it resumed.
  assert.equal(remainingToBank(iso(-5_000), NOW), 0)
  assert.equal(isPaused({ paused_remaining_ms: remainingToBank(iso(-5_000), NOW) }), true)
})

test('isSessionExpired: a paused session is never expired, a running one still is', () => {
  // The bug this exists to prevent shipped to four routes at once. Each called
  // isExpired(session.deadline_at), which cannot tell a paused session from a
  // finished one — a paused deadline is frozen in the PAST by construction.
  // /status called it 'expired', /next answered done:time_up, and /answer marked
  // every post-resume answer late. A student arriving from Continue with 277
  // seconds banked landed on "Time's up! You answered 0 exercises".
  const pausedLongAgo = { deadline_at: iso(-3_600_000), paused_remaining_ms: 20_000 }
  const pausedAtZero = { deadline_at: iso(-3_600_000), paused_remaining_ms: 0 }
  const running = { deadline_at: iso(45_000), paused_remaining_ms: null }
  const finished = { deadline_at: iso(-1_000), paused_remaining_ms: null }

  assert.equal(isSessionExpired(pausedLongAgo, NOW), false, 'paused with time banked')
  assert.equal(isSessionExpired(pausedAtZero, NOW), false, 'paused with 0 banked is still paused')
  assert.equal(isSessionExpired(running, NOW), false, 'running with time left')
  assert.equal(isSessionExpired(finished, NOW), true, 'genuinely out of time')

  // The bare check is what got this wrong — kept as the contrast, so anyone
  // tempted to "simplify" back to it sees the two disagree on purpose.
  assert.equal(isExpired(pausedLongAgo.deadline_at, NOW), true)
})
