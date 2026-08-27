/** The session length from the spec. One constant so it's changeable in one place.
 *  A dev-only "fast session" override lives in dev-fast-session.ts + the
 *  DevPanel toggle, applied where the deadline is actually computed
 *  (session/start/route.ts) rather than here — this file stays a plain,
 *  side-effect-free constant so it can be imported from a bare `tsx --test`
 *  run with no debugMode/env-var wiring to worry about. */
export const SESSION_MINUTES = 30
/** The 5-minute topic-scoped session (naale-topic-based-sessions). Same file
 *  as SESSION_MINUTES so both durations stay in one place. */
export const TOPIC_SESSION_MINUTES = 5
/** "Completed session" = reached the timer AND answered at least this many. */
export const MIN_ANSWERS_FOR_COMPLETION = 3

/** Absorbs the gap between when a session actually closes and when the
 *  server thinks its deadline was. The close-out is triggered on the
 *  STUDENT'S side; hasReachedTimer re-verifies against the SERVER's clock,
 *  and without slack here a session that visibly ran its full timer flips
 *  to "not completed."
 *
 *  Raised 2000 -> 30000 on 2026-08-24. The original 2s was sized against a
 *  single observed ~900ms drift, but real sessions were measured closing
 *  ~5.5s early — 2db627c0 at 5.702s (7 answers, 6 correct) and 0938c20d at
 *  5.312s, both denied completion despite the student sitting through the
 *  whole clock. That cost them the 50 XP completion bonus and blocked the
 *  weekly streak entirely, which needs two COMPLETED sessions a week.
 *
 *  The ~5.5s cause is NOT yet understood, and this constant is not the real
 *  fix — it makes the symptom harmless while that's investigated. Ruled out
 *  by measurement, not assumption: clock skew (browser, dev server and
 *  database all agreed within 60ms), the countdown firing early (secondsUntil
 *  rounds up, so it cannot reach zero before the deadline passes), and both
 *  server-side expiry checks (isExpired and /next, neither of which has any
 *  slack, so both fire at or after the deadline). See
 *  .claude/ai-docs/tickets/naale-session-close-timing/ for the open
 *  investigation — if the cause is found and fixed, bring this back down.
 *
 *  Spec note: naale-process-flow.md item 23 requires the timer to have
 *  elapsed AND >=3 answers, and that rule is unchanged. What this widens is
 *  how accurately "elapsed" is measured. It is a trade, not a free win — at
 *  30s a student who genuinely quits at 29:35 also counts as complete. That
 *  false positive is the cheaper error: the false negative it replaces was
 *  taking real progress away from students who did everything asked. Same
 *  class of unfairness as questions.md item 6, still open with the client.
 *  Kept at 30s rather than higher so the 60s-remaining case in
 *  tests/naale-session.test.ts stays untouched — that test is the guard
 *  against this widening into "quitting early counts." */
const TIMER_GRACE_MS = 30_000

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

/**
 * Whether `questionId` is the one question this session is currently
 * authorized to accept an answer for outside the normal rules —
 * session/next only ever sets pending_question_id to something it just
 * legitimately served (naale-topic-based-sessions).
 *
 * Three callers, all in session/answer and session/open-answer:
 *  - Timer soft stop: paired with isExpired() to let exactly this one
 *    question through after the deadline, for either MCQ or open-ended
 *    (confirmed by Noam over Slack — not open-ended-only). **That caller
 *    checks kind === 'topic' ITSELF** — see the warning below.
 *  - Exhaustion recycling (topic sessions): paired with the cross-session
 *    `answeredEver` duplicate check, since a legitimately recycled question
 *    IS already answered (in a past session) by definition.
 *  - Placement recycling (practice AND topic sessions,
 *    naale-placement-question-recycling): the same situation for a different
 *    reason — the earlier answer came from the placement quiz, and those
 *    questions are now reclaimable rather than spent.
 *
 * WIDENED from topic-only to cover that third case, which happens in the
 * 30-minute practice session too. The soft-stop callers previously leaned on
 * this function to enforce topic-only for them; they now carry their own
 * explicit kind check, because widening here without that would have handed
 * the 30-minute session a post-expiry grace answer it must never get.
 *
 * Still false for 'placement': it samples a student cold to find their level
 * and must never re-serve, so it has no legitimate use for this exemption.
 *
 * What keeps the widening safe is unchanged: pending_question_id is only ever
 * written by session/next, to a question it just chose to serve, and only one
 * such question exists per session at a time. A client cannot set it and
 * cannot use it to answer anything else twice.
 */
export function isPendingQuestion(
  session: { kind: string; pending_question_id: string | null },
  questionId: string
): boolean {
  if (session.kind === 'placement') return false
  return session.pending_question_id === questionId
}

/**
 * Whether this session kind is allowed to pause at all.
 *
 * The ONE place the 5-minute-only restriction lives. Every call site asks this
 * rather than checking `kind` itself, because the time arithmetic below is
 * kind-agnostic by nature — restricting it is the extra work, not the
 * generality — and because a future decision to allow 30-minute pausing should
 * be one function to change, with the original reasoning beside it, rather
 * than a hunt through four files.
 *
 * Topic-only for now. The reasons are product ones, not technical:
 *  - The weekly streak requires two COMPLETED 30-minute sessions, and
 *    completion requires sitting through the timer. A pausable 30-minute
 *    session could be spread across a whole day in fragments and still earn
 *    streak credit, so "two sessions a week" would stop meaning two sustained
 *    sittings.
 *  - StartSessionSheet already promises 30-minute students
 *    הישאר עד הסוף כדי שהתרגול ייחשב ("stay until the end so the practice
 *    counts"). Pausing would make that untrue.
 *  - Neither applies to topic sessions, which are excluded from the streak and
 *    from completion credit entirely, so pausing one cannot distort anything.
 *
 * Noam ruled out Start Over for 30-minute sessions explicitly; he did not rule
 * on pausing, which is a separate feature that arrived alongside it. Sequencing
 * confirmed with the user 2026-08-27: ship the 5-minute session first, revisit
 * 30-minute later. Same shape as countsAsTrackedSession() in rewards.ts — a
 * deliberate one-line flip point for a decision made-for-now rather than
 * settled.
 */
export function canPause(session: { kind: string }): boolean {
  return session.kind === 'topic'
}

/**
 * Whether a session's clock is currently stopped (naale-topic-session-resume).
 *
 * MUST be checked before any use of deadline_at on a session that could be
 * paused: a paused row's deadline_at is frozen in the past by construction, so
 * isExpired() reports true and session/start's stale sweep would close it.
 *
 * Explicitly `!== null` rather than a truthiness check — 0 is a legitimate
 * remainder (paused with no time left) and must still count as paused.
 */
export function isPaused(session: { paused_remaining_ms: number | null }): boolean {
  return session.paused_remaining_ms !== null
}

/**
 * How much time to bank when pausing. Clamped at 0 so a session paused after
 * its deadline resumes as immediately-over rather than with negative time.
 */
export function remainingToBank(deadlineAt: string, now = Date.now()): number {
  return Math.max(0, new Date(deadlineAt).getTime() - now)
}

/**
 * The deadline a resumed session should carry: whatever was left, starting now.
 * This is what keeps the pause feature from touching the timer model — the
 * deadline moves, rather than being replaced by accumulated elapsed time.
 */
export function resumedDeadline(remainingMs: number, now = Date.now()): string {
  return new Date(now + Math.max(0, remainingMs)).toISOString()
}

/**
 * The time a session has left, whether running or paused. Callers reporting
 * remaining time to a client should use this rather than secondsRemaining()
 * directly, which would read a paused session's stale deadline and report 0.
 */
/**
 * Has this session's time genuinely run out?
 *
 * Use this, never `isExpired(session.deadline_at)`, anywhere a session object is
 * in hand. A PAUSED session's deadline_at is frozen in the PAST by construction
 * — that is how banking the remainder works — so the bare deadline check reads
 * every paused session as expired and there is no way to tell the two apart
 * from the timestamp alone.
 *
 * That mistake shipped to four call sites before being caught (2026-08-27):
 * `session/status` reported a paused session as `expired` with 0 seconds left,
 * and `session/next` answered `done: time_up`, so arriving from Continue with
 * 277 seconds banked landed on "Time's up! You answered 0 exercises". None of
 * it looked like a bug in pausing — the pause had worked perfectly and the
 * banked time was sitting in the row.
 *
 * `isExpired` stays exported for the two callers that legitimately have only a
 * timestamp (the stale sweep, which skips paused rows itself, and
 * isSessionCompleted).
 */
export function isSessionExpired(
  session: { deadline_at: string; paused_remaining_ms: number | null },
  now = Date.now()
): boolean {
  if (isPaused(session)) return false
  return isExpired(session.deadline_at, now)
}

export function remainingMs(
  session: { deadline_at: string; paused_remaining_ms: number | null },
  now = Date.now()
): number {
  return isPaused(session) ? session.paused_remaining_ms! : remainingToBank(session.deadline_at, now)
}
