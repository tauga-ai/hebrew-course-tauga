import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, canPause, isPaused, remainingToBank } from '@/lib/naale/session'

/**
 * Banks a topic session's remaining time so the clock stops while the student
 * is away (naale-topic-session-resume) — Noam: "I do want them to be able to
 * resume if they get interrupted (e.g., by a phone call), so the timer should
 * pause."
 *
 * Nothing here stops a clock. It records how much time was left; session/start's
 * resume branch then sets deadline_at = now + that remainder. That is what keeps
 * this feature from touching isExpired(), secondsRemaining() or
 * isSessionCompleted() at all.
 *
 * Called from the client on pagehide/visibilitychange via sendBeacon, so it
 * must tolerate being fired repeatedly and during page teardown: every
 * non-actionable case below returns 200 rather than an error, because a beacon
 * has nobody to report a failure to and a 4xx here would only show up as noise
 * in the logs.
 *
 * Topic sessions only, via canPause() — the 30-minute session's timer is
 * deliberately an absolute limit that runs whether the student is present or
 * not. See canPause()'s own comment for why that restriction lives in one
 * place.
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

  // Ownership re-checked here as everywhere else: session_id is client-supplied
  // and must never be trusted on its own.
  const owned = await loadOwnedSession(session_id, session.student.id)
  if (!owned.ok) return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })

  if (!canPause(owned.session)) {
    return NextResponse.json({ error: 'not_pausable' }, { status: 400 })
  }

  // Already banked, or already over. Not an error: the client fires this on
  // every hide, including hides that follow an earlier pause in the same
  // absence, and re-banking would overwrite a good remainder with a smaller
  // one computed from an already-frozen deadline.
  if (isPaused(owned.session) || owned.session.ended_at) {
    return NextResponse.json({ ok: true })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('naale_sessions')
    .update({
      paused_remaining_ms: remainingToBank(owned.session.deadline_at),
      paused_at: new Date().toISOString(),
    })
    .eq('id', owned.session.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
