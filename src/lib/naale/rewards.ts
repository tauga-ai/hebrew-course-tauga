/**
 * The motivational layer. Deliberately separate from leveling: XP/coins/streak
 * never influence which question is served or how a topic's level moves, so
 * ticket 2's leveling tests stay meaningful.
 *
 * Values are the spec's PROPOSED numbers, pending product sign-off — they live
 * here as named constants precisely so changing them is a one-line edit. See
 * ticket 14's task.md and naale-track-first-build/CONTEXT.md §7/§9 for status.
 */
export const XP_PER_CORRECT = 10
export const XP_PER_COMPLETED_SESSION = 50
export const COINS_PER_CORRECT = 1
export const SESSIONS_PER_WEEK_FOR_STREAK = 2

/**
 * Israel time, Sunday-start — the natural default for an Israeli school
 * calendar. Not in the written spec; a working decision (see
 * naale-track-first-build/CONTEXT.md §7), swappable via this one constant.
 */
const STREAK_TIMEZONE = 'Asia/Jerusalem'

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/**
 * XP and coins are DERIVED, not stored and incremented.
 *
 * Storing a running total means every award path has to be idempotent — a
 * retried request, a double-tapped submit, or a replayed session-end each risk
 * awarding twice, and the bug is invisible (nobody notices 20 extra XP). Deriving
 * from naale_answers, which already has a one-row-per-question uniqueness guard,
 * makes double-counting structurally impossible.
 *
 * Trade-off: no historical ledger if the rates change later. Acceptable now;
 * revisit only if the product owner wants XP to survive a rate change.
 */
export function computeRewards(
  answers: { is_correct: boolean }[],
  sessions: { completed: boolean }[]
): { xp: number; coins: number } {
  const correct = answers.filter(a => a.is_correct).length
  const completed = sessions.filter(s => s.completed).length
  return {
    xp: correct * XP_PER_CORRECT + completed * XP_PER_COMPLETED_SESSION,
    coins: correct * COINS_PER_CORRECT,
  }
}

/**
 * The week a timestamp belongs to, as a comparable string key — the Sunday
 * (Israel calendar date) that starts its week, in Israel local time.
 *
 * Reads the calendar date/weekday AS SEEN in Israel time via
 * Intl.DateTimeFormat, then does plain calendar-date arithmetic (anchored at
 * UTC noon, so a DST transition can't shift the date) to find that week's
 * Sunday. This is what makes a session at 23:59 on a Saturday resolve to the
 * week that's about to end, rather than spilling into the next one — and a
 * session one minute later correctly starts a new week.
 */
export function weekKey(date: Date, timeZone: string = STREAK_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map(p => [p.type, p.value])) as Record<string, string>
  const y = Number(map.year)
  const m = Number(map.month)
  const d = Number(map.day)
  const dayIndex = WEEKDAY_INDEX[map.weekday]

  const sunday = new Date(Date.UTC(y, m - 1, d, 12))
  sunday.setUTCDate(sunday.getUTCDate() - dayIndex)
  return sunday.toISOString().slice(0, 10)
}

function shiftWeekKey(key: string, weeks: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d, 12))
  shifted.setUTCDate(shifted.getUTCDate() + weeks * 7)
  return shifted.toISOString().slice(0, 10)
}

/**
 * Current streak, in weeks: how many consecutive weeks, counting backward
 * from now, had at least SESSIONS_PER_WEEK_FOR_STREAK completed sessions.
 *
 * The week still in progress never breaks the streak just for not being over
 * yet — it only joins the count once it actually qualifies. A gap week (0 or
 * 1 completed session) stops the count there; older qualifying weeks beyond
 * the gap don't carry through, matching "missing a week resets the streak."
 */
export function computeStreak(completedSessionDates: Date[], now: Date = new Date()): number {
  const countByWeek = new Map<string, number>()
  for (const d of completedSessionDates) {
    const wk = weekKey(d)
    countByWeek.set(wk, (countByWeek.get(wk) ?? 0) + 1)
  }

  let cursor = weekKey(now)
  if ((countByWeek.get(cursor) ?? 0) < SESSIONS_PER_WEEK_FOR_STREAK) {
    cursor = shiftWeekKey(cursor, -1)
  }

  let streak = 0
  while ((countByWeek.get(cursor) ?? 0) >= SESSIONS_PER_WEEK_FOR_STREAK) {
    streak++
    cursor = shiftWeekKey(cursor, -1)
  }
  return streak
}
