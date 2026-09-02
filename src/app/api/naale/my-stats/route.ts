import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { buildStudentProgress } from '@/lib/naale/stats'
import { loadAllTopics, loadEnabledTopics } from '@/lib/naale/topics'
import { selectAll } from '@/lib/naale/paginate'
import { computeStreak, countsTowardStreak } from '@/lib/naale/rewards'

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

  // One student's own rows, but "one student" is not a small number over a
  // course: ~25 answers a session, several sessions a week, passes 1000 well
  // inside a school year. Levels stay at one row per topic, so they don't.
  const studentId = session.student.id
  const [allTopics, allTopicsUnfiltered, { data: levels }, answers, openAnswers, sessions] = await Promise.all([
    loadEnabledTopics(db),
    // Unfiltered by naale_topic_flags — the page's own LOCKED_TOPICS overlay
    // (real content never imported yet) needs to tell "never imported" apart
    // from "admin disabled", since both are absent from `topics` above but
    // only the former should render as a "coming soon" card rather than
    // vanishing (naale-topic-toggle).
    loadAllTopics(db),
    db.from('naale_topic_levels').select('topic, level').eq('student_id', studentId),
    selectAll<{ topic: string; is_correct: boolean; session_id: string; is_review: boolean }>('naale_answers', (from, to) =>
      db.from('naale_answers').select('topic, is_correct, session_id, is_review').eq('student_id', studentId).range(from, to)),
    selectAll<{ topic: string; score: number; session_id: string; is_review: boolean }>('naale_open_answers', (from, to) =>
      db.from('naale_open_answers').select('topic, score, session_id, is_review').eq('student_id', studentId).range(from, to)),
    selectAll<{ id: string; kind: string; completed: boolean; started_at: string }>('naale_sessions', (from, to) =>
      db.from('naale_sessions').select('id, kind, completed, started_at').eq('student_id', studentId).range(from, to)),
  ])

  // Every rule behind these numbers — review answers excluded, a graded 4-5
  // counting as correct, placement earning no XP/coins — lives in
  // buildStudentProgress() rather than here, so this view and staff's view of
  // the same student cannot drift apart. See that function for why it's shared
  // rather than copied.
  const progress = buildStudentProgress({
    allTopics,
    levels: levels ?? [],
    answers,
    openAnswers,
    sessions,
  })

  // The one number staff's view doesn't show, so it stays out of the shared
  // builder.
  const streak = computeStreak(
    sessions.filter(s => s.completed && countsTowardStreak(s)).map(s => new Date(s.started_at))
  )

  return NextResponse.json({
    topics: progress.topics,
    totals: { ...progress.totals, streak },
    allTopics: allTopicsUnfiltered,
  })
}
