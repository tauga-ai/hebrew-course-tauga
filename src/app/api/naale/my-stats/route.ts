import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { buildTopicStats } from '@/lib/naale/stats'
import { computeRewards, computeStreak, computeGradedRewards } from '@/lib/naale/rewards'

/**
 * The authenticated Naale student's own progress — per-topic level and exercise
 * counts. This is the spec's JSON "ID card": it isn't stored as a blob anywhere,
 * it's assembled here from naale_topic_levels + naale_answers.
 *
 * Scoped to session.student.id only. There is deliberately no student_id
 * parameter — students see themselves and nobody else (staff use
 * /api/naale/staff/students instead).
 */
export async function GET() {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()

  const [{ data: bankTopics }, { data: openBankTopics }, { data: levels }, { data: answers }, { data: openAnswers }, { data: sessions }] = await Promise.all([
    db.from('naale_questions').select('topic'),
    db.from('naale_open_questions').select('topic'),
    db.from('naale_topic_levels').select('topic, level').eq('student_id', session.student.id),
    db.from('naale_answers').select('topic, is_correct, session_id, is_review').eq('student_id', session.student.id),
    db.from('naale_open_answers').select('topic, score, session_id, is_review').eq('student_id', session.student.id),
    db.from('naale_sessions').select('id, kind, completed, started_at').eq('student_id', session.student.id),
  ])

  // Review answers (ticket 15) are excluded from every count below — a
  // re-answer of an already-answered question would otherwise look like
  // double-counted progress. Working decision, naale-track-first-build
  // /CONTEXT.md §9, not yet Yuval-confirmed.
  const nonReviewAnswers = (answers ?? []).filter(a => !a.is_review)
  const nonReviewOpenAnswers = (openAnswers ?? []).filter(a => !a.is_review)

  const allTopics = [...new Set([...(bankTopics ?? []).map(r => r.topic), ...(openBankTopics ?? []).map(r => r.topic)])].sort()
  // buildTopicStats() takes {topic, is_correct} — a graded score of 4-5 maps
  // to "correct" for this progress view, matching the leveling/coin threshold
  // used everywhere else a graded score needs a pass/fail read.
  const topics = buildTopicStats(allTopics, levels ?? [], [
    ...nonReviewAnswers,
    ...nonReviewOpenAnswers.map(a => ({ topic: a.topic, is_correct: a.score >= 4 })),
  ])

  // XP/coins/streak: ticket 14's motivational layer, derived at read time from
  // the rows above — see src/lib/naale/rewards.ts for why this is derived
  // rather than a stored, incrementable counter.
  //
  // Placement answers are excluded from XP/coins: placement is calibration,
  // not practice, same reasoning ticket 11 already used to exclude it from
  // the leveling streak and the session-completion bonus (naale_sessions
  // .completed is always false for placement, which already excludes it
  // from the bonus/streak below — this filter is what additionally excludes
  // it from the per-correct-answer XP, which isn't gated by `completed`).
  const practiceSessionIds = new Set((sessions ?? []).filter(s => s.kind === 'practice').map(s => s.id))
  const practiceAnswers = nonReviewAnswers.filter(a => practiceSessionIds.has(a.session_id))
  const practiceOpenAnswers = nonReviewOpenAnswers.filter(a => practiceSessionIds.has(a.session_id))

  const { xp: mcqXp, coins: mcqCoins } = computeRewards(practiceAnswers, sessions ?? [])
  const { xp: gradedXp, coins: gradedCoins } = computeGradedRewards(practiceOpenAnswers)
  const streak = computeStreak(
    (sessions ?? []).filter(s => s.completed).map(s => new Date(s.started_at))
  )

  return NextResponse.json({
    topics,
    totals: {
      answered: nonReviewAnswers.length + nonReviewOpenAnswers.length,
      correct: nonReviewAnswers.filter(a => a.is_correct).length + nonReviewOpenAnswers.filter(a => a.score >= 4).length,
      sessions: (sessions ?? []).length,
      completed_sessions: (sessions ?? []).filter(s => s.completed).length,
      xp: mcqXp + gradedXp,
      coins: mcqCoins + gradedCoins,
      streak,
    },
  })
}
