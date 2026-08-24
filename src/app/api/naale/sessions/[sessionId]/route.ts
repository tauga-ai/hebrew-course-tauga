import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession } from '@/lib/naale/session'
import { buildSessionProgress } from '@/lib/naale/stats'

/**
 * One past session's own breakdown — the detail half of the session-history
 * browser on /naale/stats.
 *
 * The session id comes from the URL, so ownership is re-derived through
 * loadOwnedSession() rather than trusted. Without that check, editing the
 * uuid in the address bar would read another student's session. This is the
 * same guard /session/end and /session/summary use, and the reason this route
 * is not in tests/auth-guard.test.mjs's public allowlist.
 *
 * Deliberately returns the same shape the end-of-session recap already
 * renders, computed by the same helper: a session viewed here weeks later
 * must show the numbers that were true THEN (level_at_answer per row), not
 * the student's current levels.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { sessionId } = await params

  const owned = await loadOwnedSession(sessionId, session.student.id)
  if (!owned.ok) return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })
  const s = owned.session

  const db = createServiceClient()
  const [{ data: answers }, { data: openAnswers }, { data: stored }] = await Promise.all([
    db.from('naale_answers')
      .select('is_correct, topic, level_at_answer')
      .eq('session_id', s.id).eq('is_review', false),
    db.from('naale_open_answers')
      .select('score, topic, level_at_answer')
      .eq('session_id', s.id).eq('is_review', false),
    // The AI note this session originally got. Read here rather than through
    // loadOwnedSession() so its shared select stays out of the summary
    // feature's way — ten routes use that helper, and only these two need
    // these columns.
    db.from('naale_sessions')
      .select('summary_text, summary_icon')
      .eq('id', s.id)
      .maybeSingle<{ summary_text: string | null; summary_icon: string | null }>(),
  ])

  const progress = buildSessionProgress(s.id, s.kind, s.completed, answers ?? [], openAnswers ?? [])

  return NextResponse.json({
    id: s.id,
    kind: s.kind,
    started_at: s.started_at,
    ended_at: s.ended_at,
    completed: s.completed,
    answered_count: s.answered_count,
    correct_count: progress.totals.correct,
    xp_earned: progress.totals.xp,
    coins_earned: progress.totals.coins,
    topics: progress.topics,
    // Null for every session that ended before the AI summary shipped, and
    // for any where the call failed — failures deliberately aren't persisted.
    // The client renders nothing rather than an empty card.
    summary_text: stored?.summary_text ?? null,
    summary_icon: stored?.summary_icon ?? null,
  })
}
