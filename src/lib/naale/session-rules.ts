/** The session length from the spec. One constant so it's changeable in one place.
 *  A dev-only "fast session" override lives in dev-fast-session.ts + the
 *  DevPanel toggle, applied where the deadline is actually computed
 *  (session/start/route.ts) rather than here — this file stays a plain,
 *  side-effect-free constant so it can be imported from a bare `tsx --test`
 *  run with no debugMode/env-var wiring to worry about. */
export const SESSION_MINUTES = 30
/** "Completed session" = reached the timer AND answered at least this many. */
export const MIN_ANSWERS_FOR_COMPLETION = 3

/** Absorbs ordinary client/server clock drift at the exact deadline
 *  boundary. The session close-out is triggered by the STUDENT'S device
 *  clock reaching what it believes is the deadline; hasReachedTimer
 *  independently re-verifies against the SERVER's own clock. Without slack
 *  here, ordinary drift (observed in production: ~900ms) can flip a session
 *  that visibly ran its full clock into "not completed." Small enough to
 *  stay well below any genuinely-early finish — see the 60s-remaining case
 *  in tests/naale-session.test.ts, which stays unaffected. */
const TIMER_GRACE_MS = 2000

export function hasReachedTimer(deadlineAt: string, now = Date.now()): boolean {
  return new Date(deadlineAt).getTime() - TIMER_GRACE_MS <= now
}

/**
 * The spec's completion rule: reaching the end of the timer, PLUS a minimum of
 * 3 questions answered. Reaching 30 minutes with fewer than 3 answered does
 * NOT count — it's what gates the XP bonus and the weekly streak later.
 *
 * Pure so it's unit-testable; callers pass the stored deadline and count.
 */
export function isSessionCompleted(deadlineAt: string, answeredCount: number, now = Date.now()): boolean {
  return hasReachedTimer(deadlineAt, now) && answeredCount >= MIN_ANSWERS_FOR_COMPLETION
}

/** Deliberately NOT given the same grace window — this gates whether an
 *  answer submission is accepted at all, a different concern from session
 *  completion. See naale-session-completion-clock-race/task.md §1 for why
 *  this stays untouched. */
export function isExpired(deadlineAt: string, now = Date.now()): boolean {
  return new Date(deadlineAt).getTime() <= now
}

export function secondsRemaining(deadlineAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000))
}
