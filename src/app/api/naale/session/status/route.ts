import { NextRequest, NextResponse } from 'next/server'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isExpired, secondsRemaining } from '@/lib/naale/session'

/**
 * Current state of one session — what the UI reads after a reload to resume
 * with the correct remaining time rather than a fresh 30 minutes.
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
  return NextResponse.json({
    session_id: s.id,
    kind: s.kind,
    deadline_at: s.deadline_at,
    seconds_remaining: secondsRemaining(s.deadline_at),
    answered_count: s.answered_count,
    ended: s.ended_at !== null,
    expired: isExpired(s.deadline_at),
    completed: s.completed,
  })
}
