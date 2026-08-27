import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isExpired, secondsRemaining, readDevSessionMinutesOverride, canPause, isPaused, remainingMs } from '@/lib/naale/session'

/**
 * Current state of one session — what the UI reads after a reload to resume
 * with the correct remaining time rather than a fresh 30 minutes.
 *
 * A plain page reload calls THIS route, not session/start (that only runs
 * from the home page's "Practice" button) — so the dev session-length
 * override recompute has to live here too, or changing the override while a
 * session is in progress would only ever be visible after leaving and
 * re-entering practice, not on a reload.
 */
export async function GET(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })

  const owned = await loadOwnedSession(sessionId, session.student.id)
  if (!owned.ok) return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })

  const s = owned.session
  const db = createServiceClient()

  // Same combined mcq + open-response "correct" count as /session/end —
  // correctCount on the client is a plain incrementing counter with nothing
  // resetting it between sessions, so without this the boot flow (which
  // already resyncs answered_count below) leaves a stale count from a
  // previous session on screen until this session's own /end call replaces
  // it. Skipped for placement, same as everywhere else that computes rewards.
  const [{ data: sessionAnswers }, { data: sessionOpenAnswers }] = s.kind === 'placement'
    ? [{ data: [] as { is_correct: boolean }[] }, { data: [] as { score: number }[] }]
    : await Promise.all([
        db.from('naale_answers').select('is_correct').eq('session_id', s.id).eq('is_review', false),
        db.from('naale_open_answers').select('score').eq('session_id', s.id).eq('is_review', false),
      ])
  const correct_count = (sessionAnswers ?? []).filter(a => a.is_correct).length
    + (sessionOpenAnswers ?? []).filter(a => a.score >= 4).length

  // Dev-only session-length override. Deliberately NOT applied to a pausable
  // session: the recompute below assumes deadline_at is always
  // started_at + N, and pausing exists precisely to break that invariant by
  // moving the deadline later (naale-topic-session-resume). Applied to a topic
  // session it snaps the resumed deadline back onto the started_at line —
  // which is in the past by then — so the session reports `expired` and the
  // client force-closes it the instant the student resumes. Observed live:
  // a resumed 2-minute session came back reading deadline = started_at + 2.00m
  // exactly, and died 12s later.
  //
  // Topic sessions still honour the override at CREATION (session/start picks
  // the length from it), which is all QA actually needs — the override's job
  // is sparing a 30-minute wait, and five minutes was never the problem.
  let deadline_at = s.deadline_at
  if (!s.ended_at && !canPause(s)) {
    const overrideMinutes = await readDevSessionMinutesOverride()
    if (overrideMinutes !== null) {
      const recomputed = new Date(new Date(s.started_at).getTime() + overrideMinutes * 60 * 1000).toISOString()
      if (recomputed !== s.deadline_at) {
        await db.from('naale_sessions').update({ deadline_at: recomputed }).eq('id', s.id)
        deadline_at = recomputed
      }
    }
  }

  // A paused session's deadline_at is frozen in the PAST — that is how banking
  // the remainder works (naale-topic-session-resume). Reported raw, it says
  // "0 seconds left, expired", and the session page believes it: boot calls
  // finishSession('time_up') and ends the session on sight. So a reload, or
  // any boot onto a paused session, would destroy exactly what the pause
  // preserved. The banked remainder is the truth here, not the clock.
  const paused = isPaused(s)

  return NextResponse.json({
    session_id: s.id,
    kind: s.kind,
    deadline_at,
    seconds_remaining: paused ? Math.ceil(remainingMs(s) / 1000) : secondsRemaining(deadline_at),
    paused,
    answered_count: s.answered_count,
    correct_count,
    ended: s.ended_at !== null,
    expired: paused ? false : isExpired(deadline_at),
    completed: s.completed,
    translation_lang: session.student.translation_lang ?? 'ru',
  })
}
