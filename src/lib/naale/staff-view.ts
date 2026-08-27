import type { NaaleTopicStat } from './stats'

/**
 * Shapes and pure helpers shared by the staff roster (`/naale/staff`) and the
 * per-student detail page (`/naale/staff/students/[studentId]`).
 *
 * These lived inside staff/page.tsx while the detail view was a dialog in the
 * same file. Extracted when detail moved to its own route so the two surfaces
 * can't drift into disagreeing about what "needs attention" or "excellent"
 * means — the same reason buildStudentProgress() is shared between the staff
 * and student endpoints.
 */

export interface StaffTotals {
  answered: number
  correct: number
  sessions: number
  completed_sessions: number
  xp: number
  coins: number
}

/** What the roster table needs per row — deliberately without `topics` or
 *  `session_dates`, which only the detail page reads. */
export interface StaffStudentRow {
  student_id: string
  full_name: string
  avatar_url: string | null
  totals: StaffTotals
}

/** The detail page's shape: a row plus the depth the roster doesn't carry. */
export interface StaffStudentDetail extends StaffStudentRow {
  topics: NaaleTopicStat[]
  /** Both session kinds, tagged — the attendance calendar's type toggle
   *  filters these client-side. `kind` added by naale-staff-attendance-calendar;
   *  before that this was practice-only and 5-minute topic sessions never
   *  reached the client at all. */
  session_dates: { id: string; started_at: string; kind: string }[]
}

// Not a spec number — the "bad" threshold scoreColor() already uses everywhere
// else in the app. Retune here if 50% turns out to be the wrong cutoff for this
// cohort.
export const NEEDS_ATTENTION_THRESHOLD = 50

export function overallAccuracy(totals: StaffTotals): number | null {
  return totals.answered > 0 ? Math.round((totals.correct / totals.answered) * 100) : null
}

export function statusLabel(acc: number | null): string {
  if (acc === null) return 'לא התחיל'
  if (acc >= 70) return 'מצוין'
  if (acc >= 50) return 'סביר'
  return 'דורש תשומת לב'
}
