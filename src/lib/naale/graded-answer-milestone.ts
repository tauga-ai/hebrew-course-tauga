import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { consecutiveGoodScoreStreak, STREAK_MILESTONES } from './rewards'

type RecentAnswerRow = { score: number; session_id: string; answered_at: string }

/**
 * The "3/5/10 in a row" streak-milestone check, shared across every
 * AI-graded answers table — extracted out of what was previously
 * session/open-answer/route.ts's own inline version so a second (and now
 * third) graded topic doesn't each carry a slightly-drifting copy of the same
 * logic. A debate (or role-play) answer landing between two open-topic
 * answers must not silently break the streak in either direction, so this
 * merges all of them before computing it.
 *
 * Fetches more rows than the largest milestone (10) from each table — capping
 * at exactly 10 would make consecutiveGoodScoreStreak() unable to tell a
 * streak of exactly 10 apart from one of 15, so the "10 in a row" celebration
 * would silently refire on every answer after the 10th instead of firing once.
 *
 * Placement answers are excluded, same reasoning as XP/coins/session
 * completion already exclude them elsewhere (naale-placement-question-recycling):
 * placement is calibration, not practice.
 */
export async function fetchRecentGradedAnswersMilestone(db: SupabaseClient, studentId: string): Promise<number | null> {
  const [{ data: openRows }, { data: debateRows }] = await Promise.all([
    db.from('naale_open_answers').select('score, session_id, answered_at').eq('student_id', studentId).eq('is_review', false).order('answered_at', { ascending: false }).limit(15),
    db.from('naale_debate_answers').select('score, session_id, answered_at').eq('student_id', studentId).eq('is_review', false).order('answered_at', { ascending: false }).limit(15),
  ])
  const recentAnswers: RecentAnswerRow[] = [...(openRows ?? []), ...(debateRows ?? [])]
    .sort((a, b) => (a.answered_at < b.answered_at ? 1 : -1))
    .slice(0, 15)

  const sessionIds = [...new Set(recentAnswers.map(a => a.session_id))]
  const { data: recentSessions } = sessionIds.length
    ? await db.from('naale_sessions').select('id, kind').in('id', sessionIds)
    : { data: [] }
  const placementIds = new Set((recentSessions ?? []).filter(s => s.kind === 'placement').map(s => s.id))

  const streak = consecutiveGoodScoreStreak(recentAnswers.filter(a => !placementIds.has(a.session_id)))
  return STREAK_MILESTONES.includes(streak as typeof STREAK_MILESTONES[number]) ? streak : null
}
