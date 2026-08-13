/** The session length from the spec. One constant so it's changeable in one place.
 *  A dev-only "fast session" override lives in dev-fast-session.ts + the
 *  DevPanel toggle, applied where the deadline is actually computed
 *  (session/start/route.ts) rather than here — this file stays a plain,
 *  side-effect-free constant so it can be imported from a bare `tsx --test`
 *  run with no isDev/env-var wiring to worry about. */
export const SESSION_MINUTES = 30
/** "Completed session" = reached the timer AND answered at least this many. */
export const MIN_ANSWERS_FOR_COMPLETION = 3

/**
 * The spec's completion rule: reaching the end of the timer, PLUS a minimum of
 * 3 questions answered. Reaching 30 minutes with fewer than 3 answered does
 * NOT count — it's what gates the XP bonus and the weekly streak later.
 *
 * Pure so it's unit-testable; callers pass the stored deadline and count.
 */
export function isSessionCompleted(deadlineAt: string, answeredCount: number, now = Date.now()): boolean {
  const reachedTimer = new Date(deadlineAt).getTime() <= now
  return reachedTimer && answeredCount >= MIN_ANSWERS_FOR_COMPLETION
}

export function isExpired(deadlineAt: string, now = Date.now()): boolean {
  return new Date(deadlineAt).getTime() <= now
}

export function secondsRemaining(deadlineAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000))
}
