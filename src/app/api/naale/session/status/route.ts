import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isExpired, secondsRemaining, readDevSessionMinutesOverride } from '@/lib/naale/session'

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

  let deadline_at = s.deadline_at
  if (!s.ended_at) {
    const overrideMinutes = await readDevSessionMinutesOverride()
    if (overrideMinutes !== null) {
      const recomputed = new Date(new Date(s.started_at).getTime() + overrideMinutes * 60 * 1000).toISOString()
      if (recomputed !== s.deadline_at) {
        const db = createServiceClient()
        await db.from('naale_sessions').update({ deadline_at: recomputed }).eq('id', s.id)
        deadline_at = recomputed
      }
    }
  }

  return NextResponse.json({
    session_id: s.id,
    kind: s.kind,
    deadline_at,
    seconds_remaining: secondsRemaining(deadline_at),
    answered_count: s.answered_count,
    ended: s.ended_at !== null,
    expired: isExpired(deadline_at),
    completed: s.completed,
  })
}
