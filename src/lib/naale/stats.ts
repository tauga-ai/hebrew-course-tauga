import type { NaaleTopicLevel } from '@/lib/types'
import { COIN_SCORE_THRESHOLD, computeGradedRewards, computeRewards } from './rewards'

export interface NaaleTopicStat {
  topic: string
  /** null when the student has no level row yet — i.e. not placed / not started. */
  level: number | null
  answered: number
  correct: number
  /** null when nothing has been attempted, so the UI can render "—" rather
   *  than a 0% that reads as failure. Mirrors computeStats() in quiz-progress.ts. */
  accuracy_pct: number | null
  started: boolean
}

/**
 * Shapes a student's raw rows into the per-topic view the stats screens show —
 * the spec's "ID card", assembled at read time rather than stored as a blob
 * (see migration_naale_track.sql for why).
 *
 * `allTopics` comes from the question bank, not from the student's rows, so a
 * topic the student has never touched still appears (marked not-started)
 * instead of silently vanishing from their progress view.
 *
 * Pure, so the staff view can reuse it per-student and so it's testable.
 */
export function buildTopicStats(
  allTopics: string[],
  levels: Pick<NaaleTopicLevel, 'topic' | 'level'>[],
  answers: { topic: string; is_correct: boolean }[]
): NaaleTopicStat[] {
  const levelByTopic = new Map(levels.map(l => [l.topic, l.level]))

  const counts = new Map<string, { answered: number; correct: number }>()
  for (const a of answers) {
    const c = counts.get(a.topic) ?? { answered: 0, correct: 0 }
    c.answered += 1
    if (a.is_correct) c.correct += 1
    counts.set(a.topic, c)
  }

  return allTopics.map(topic => {
    const c = counts.get(topic) ?? { answered: 0, correct: 0 }
    return {
      topic,
      level: levelByTopic.get(topic) ?? null,
      answered: c.answered,
      correct: c.correct,
      accuracy_pct: c.answered > 0 ? (c.correct / c.answered) * 100 : null,
      started: levelByTopic.has(topic) || c.answered > 0,
    }
  })
}

/** A graded (1-5) answer counts as "correct" for progress at 4 or above.
 *  Aliased rather than re-stated as a literal so it can't drift from
 *  applyGradedAnswer()'s leveling threshold or the coin threshold. */
export const GRADED_CORRECT_SCORE = COIN_SCORE_THRESHOLD

export interface NaaleProgressInput {
  /** Every topic in BOTH banks — MCQ and AI-graded. Passing only the MCQ
   *  bank is exactly the bug this function exists to prevent (audit H1). */
  allTopics: string[]
  levels: Pick<NaaleTopicLevel, 'topic' | 'level'>[]
  answers: { topic: string; is_correct: boolean; is_review: boolean; session_id: string }[]
  openAnswers: { topic: string; score: number; is_review: boolean; session_id: string }[]
  sessions: { id: string; kind: string; completed: boolean }[]
}

export interface NaaleProgress {
  topics: NaaleTopicStat[]
  totals: {
    answered: number
    correct: number
    sessions: number
    completed_sessions: number
    xp: number
    coins: number
  }
}

/**
 * One student's whole progress view — the spec's "ID card" — from their raw
 * rows. Shared by /api/naale/my-stats (the student's own view) and
 * /api/naale/staff/students (staff's view of them).
 *
 * Shared deliberately. These two screens previously derived the same numbers
 * from two separate copies of this logic, and they drifted: the staff route
 * built its topic list from `naale_questions` alone, so all three AI-graded
 * topics vanished from it entirely — level, exercise count and accuracy
 * together — while the student's own screen showed them (audit H1). A student
 * and their teacher could look at the same progress and read different
 * numbers. Copying the logic a third time would just set up the next
 * divergence, so both routes now call this.
 *
 * Two rules baked in, both matching what the student's own view already did:
 *  - Review answers are excluded from every count — re-answering a question
 *    already answered would otherwise look like double progress.
 *  - Placement answers earn no XP or coins; placement is calibration, not
 *    practice. Its answers still count toward answered/correct.
 *
 * Pure, so it's testable and so neither route can quietly special-case it.
 */
export function buildStudentProgress(input: NaaleProgressInput): NaaleProgress {
  const answers = input.answers.filter(a => !a.is_review)
  const openAnswers = input.openAnswers.filter(a => !a.is_review)

  const topics = buildTopicStats(input.allTopics, input.levels, [
    ...answers,
    ...openAnswers.map(a => ({ topic: a.topic, is_correct: a.score >= GRADED_CORRECT_SCORE })),
  ])

  const practiceSessionIds = new Set(input.sessions.filter(s => s.kind === 'practice').map(s => s.id))
  const { xp: mcqXp, coins: mcqCoins } = computeRewards(
    answers.filter(a => practiceSessionIds.has(a.session_id)),
    input.sessions
  )
  const { xp: gradedXp, coins: gradedCoins } = computeGradedRewards(
    openAnswers.filter(a => practiceSessionIds.has(a.session_id))
  )

  return {
    topics,
    totals: {
      answered: answers.length + openAnswers.length,
      correct:
        answers.filter(a => a.is_correct).length +
        openAnswers.filter(a => a.score >= GRADED_CORRECT_SCORE).length,
      sessions: input.sessions.length,
      completed_sessions: input.sessions.filter(s => s.completed).length,
      xp: mcqXp + gradedXp,
      coins: mcqCoins + gradedCoins,
    },
  }
}

export interface SessionAnswerRow {
  topic: string
  is_correct: boolean
  level_at_answer: number
}
export interface SessionOpenAnswerRow {
  topic: string
  score: number
  level_at_answer: number
}

/**
 * One session's own progress view, reusing buildStudentProgress() rather than
 * re-deriving per-topic logic a second time. `allTopics`/`levels` are built
 * from the session's own rows (only topics actually touched appear; level is
 * `level_at_answer`, captured per row at answer time, not the student's
 * current live level from naale_topic_levels) — a past session's breakdown
 * should reflect what was true then, not now.
 */
export function buildSessionProgress(
  sessionId: string,
  sessionKind: string,
  sessionCompleted: boolean,
  answers: SessionAnswerRow[],
  openAnswers: SessionOpenAnswerRow[]
): NaaleProgress {
  const topicsTouched = new Set([...answers.map(a => a.topic), ...openAnswers.map(a => a.topic)])
  const levelByTopic = new Map<string, number>()
  for (const a of [...answers, ...openAnswers]) levelByTopic.set(a.topic, a.level_at_answer)

  return buildStudentProgress({
    allTopics: [...topicsTouched],
    levels: [...levelByTopic].map(([topic, level]) => ({ topic, level })),
    answers: answers.map(a => ({ ...a, is_review: false, session_id: sessionId })),
    openAnswers: openAnswers.map(a => ({ ...a, is_review: false, session_id: sessionId })),
    sessions: [{ id: sessionId, kind: sessionKind, completed: sessionCompleted }],
  })
}

export interface SessionDay {
  /** he-IL formatted date — the same string the UI renders beside the count. */
  label: string
  /** ISO timestamp of the latest session that day, for sorting. */
  latest: string
  count: number
  session_ids: string[]
}

/**
 * Collapses sessions that share a calendar day into one entry.
 *
 * One row per session renders two sessions on the same day as two visually
 * identical dates, since no time is shown — and Noam's five-minute sessions
 * make several-a-day the normal case, not an edge case. Grouped on the he-IL
 * date string rather than a UTC day boundary so the grouping can never
 * disagree with the label displayed next to it.
 *
 * Lives here rather than in session-history.ts (which is in-session
 * back/forward navigation) so staff and student screens shape this the same
 * way, for the same reason buildStudentProgress() is shared.
 */
export function groupSessionsByDay(sessions: { id: string; started_at: string }[]): SessionDay[] {
  const byLabel = new Map<string, SessionDay>()

  for (const s of sessions) {
    const label = new Date(s.started_at).toLocaleDateString('he-IL')
    const existing = byLabel.get(label)
    if (existing) {
      existing.count += 1
      existing.session_ids.push(s.id)
      if (s.started_at > existing.latest) existing.latest = s.started_at
    } else {
      byLabel.set(label, { label, latest: s.started_at, count: 1, session_ids: [s.id] })
    }
  }

  return [...byLabel.values()].sort((a, b) => (a.latest < b.latest ? 1 : -1))
}

/** Days of attendance the staff detail view shows at once. A sliding window for
 *  now; once the program has a start date behind it, "since the program began"
 *  is the more honest frame — it grows instead of dropping history off the end. */
export const ATTENDANCE_DAYS = 28

export interface AttendanceDay {
  /** he-IL date, matching groupSessionsByDay()'s keys. */
  label: string
  /** Sessions started that day. 0 for a day with no practice. */
  count: number
  /** Day-of-month, for the sparse axis labels under the strip. */
  dayOfMonth: number
  isToday: boolean
}

/**
 * One cell per day for the last `days` days, oldest first, counting sessions.
 *
 * The gaps are the point: a list of dates shows when a student practiced, but
 * only a continuous run of days shows when they *didn't* — which is the thing
 * a counselor is actually trying to see. Built by walking the local calendar
 * with setDate() rather than subtracting milliseconds, so a DST shift can't
 * duplicate or skip a day.
 *
 * `now` is a parameter so this is testable; callers pass new Date().
 */
export function buildAttendanceWindow(
  sessions: { id: string; started_at: string }[],
  now: Date,
  days: number = ATTENDANCE_DAYS
): AttendanceDay[] {
  const countByLabel = new Map<string, number>()
  for (const day of groupSessionsByDay(sessions)) countByLabel.set(day.label, day.count)

  const todayLabel = now.toLocaleDateString('he-IL')
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))

  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const label = d.toLocaleDateString('he-IL')
    return {
      label,
      count: countByLabel.get(label) ?? 0,
      dayOfMonth: d.getDate(),
      isToday: label === todayLabel,
    }
  })
}
