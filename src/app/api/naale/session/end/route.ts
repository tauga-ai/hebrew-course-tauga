import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isSessionCompleted, hasReachedTimer, MIN_ANSWERS_FOR_COMPLETION } from '@/lib/naale/session'
import { computeRewards, computeGradedRewards, computeStreak } from '@/lib/naale/rewards'
import { selectAll } from '@/lib/naale/paginate'
import { buildSessionProgress } from '@/lib/naale/stats'

/**
 * Ends a session and decides whether it counts as "completed" — reaching the
 * timer AND at least 3 answers, evaluated server-side from the stored deadline
 * and answer count. The client cannot claim completion.
 *
 * Safe to call twice: an already-ended session is returned unchanged rather
 * than re-stamped, so a "finish" button double-tap or an unload handler firing
 * alongside an explicit end can't rewrite history.
 *
 * Also returns this session's own XP/coins earned and the updated overall
 * streak (ticket 14) — computed the same way on both the fresh-end and
 * already-ended paths, so a reload lands on the same summary numbers rather
 * than a blank one.
 */
export async function POST(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let session_id: string
  try {
    ({ session_id } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }
  if (!session_id) return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })

  const owned = await loadOwnedSession(session_id, session.student.id)
  if (!owned.ok) return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })

  const s = owned.session
  const db = createServiceClient()

  let completed: boolean
  let alreadyEnded: boolean
  let reachedTimer: boolean

  if (s.ended_at) {
    completed = s.completed
    alreadyEnded = true
    // Recompute against the moment the session actually closed, not "now" —
    // by the time this runs again (e.g. a page reload), real time has long
    // since passed the deadline either way, which would always say "yes"
    // and hide which half of the rule actually failed at close time.
    reachedTimer = hasReachedTimer(s.deadline_at, new Date(s.ended_at).getTime())
  } else {
    const now = Date.now()
    reachedTimer = hasReachedTimer(s.deadline_at, now)
    completed = isSessionCompleted(s.deadline_at, s.answered_count, now)
    alreadyEnded = false
    const { error } = await db
      .from('naale_sessions')
      .update({ ended_at: new Date().toISOString(), completed })
      .eq('id', s.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Placement sessions never earn XP/coins — same reasoning as the my-stats
  // route: placement is calibration, not practice. `completed` is already
  // always false for placement (excluding the +50 bonus), but the
  // per-correct-answer XP needs this explicit kind check too.
  const [{ data: sessionAnswers }, { data: sessionOpenAnswers }, allSessions] = await Promise.all([
    s.kind === 'placement'
      ? Promise.resolve({ data: [] as { is_correct: boolean; topic: string; level_at_answer: number }[] })
      // Review answers (ticket 15) excluded too — same working decision as
      // my-stats and staff/students, naale-track-first-build/CONTEXT.md §9.
      : db.from('naale_answers').select('is_correct, topic, level_at_answer').eq('session_id', s.id).eq('is_review', false),
    // Was missing entirely until now — this session's AI-graded (open-response)
    // answers never contributed to its own end-of-session xp_earned/coins_earned
    // or correct_count, even though my-stats' running total already includes
    // them correctly. A session containing only open-response answers always
    // showed "0 XP" on this screen regardless of how well the student did.
    s.kind === 'placement'
      ? Promise.resolve({ data: [] as { score: number; topic: string; level_at_answer: number }[] })
      : db.from('naale_open_answers').select('score, topic, level_at_answer').eq('session_id', s.id).eq('is_review', false),
    // Every session this account has ever had, for the weekly streak — one a
    // day crosses the row cap inside three years.
    selectAll<{ completed: boolean; started_at: string }>('naale_sessions', (from, to) =>
      db.from('naale_sessions').select('completed, started_at').eq('student_id', session.student.id).range(from, to)),
  ])

  const { xp: mcqXp, coins: mcqCoins } = computeRewards(sessionAnswers ?? [], [{ completed }])
  const { xp: gradedXp, coins: gradedCoins } = computeGradedRewards(sessionOpenAnswers ?? [])
  const streak = computeStreak(
    allSessions.filter(x => x.completed).map(x => new Date(x.started_at))
  )
  // Same "4-5 counts as correct" read as everywhere else a graded score needs
  // a pass/fail comparison (my-stats, placementLevel, applyGradedAnswer).
  const correct_count = (sessionAnswers ?? []).filter(a => a.is_correct).length
    + (sessionOpenAnswers ?? []).filter(a => a.score >= 4).length
  // Per-topic breakdown for just this session (ticket: naale-session-breakdown)
  // — reuses the same shared aggregation logic as the all-time stats views,
  // scoped to this session's own rows via level_at_answer rather than the
  // student's current live level.
  const { topics } = buildSessionProgress(s.id, s.kind, completed, sessionAnswers ?? [], sessionOpenAnswers ?? [])

  return NextResponse.json({
    answered_count: s.answered_count,
    correct_count,
    completed,
    reached_timer: reachedTimer,
    min_answers: MIN_ANSWERS_FOR_COMPLETION,
    already_ended: alreadyEnded,
    xp_earned: mcqXp + gradedXp,
    coins_earned: mcqCoins + gradedCoins,
    streak,
    topics,
  })
}
