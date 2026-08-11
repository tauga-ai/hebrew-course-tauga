import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isSessionCompleted, MIN_ANSWERS_FOR_COMPLETION } from '@/lib/naale/session'

/**
 * Ends a session and decides whether it counts as "completed" — reaching the
 * timer AND at least 3 answers, evaluated server-side from the stored deadline
 * and answer count. The client cannot claim completion.
 *
 * Safe to call twice: an already-ended session is returned unchanged rather
 * than re-stamped, so a "finish" button double-tap or an unload handler firing
 * alongside an explicit end can't rewrite history.
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
  if (s.ended_at) {
    return NextResponse.json({
      answered_count: s.answered_count,
      completed: s.completed,
      min_answers: MIN_ANSWERS_FOR_COMPLETION,
      already_ended: true,
    })
  }

  const completed = isSessionCompleted(s.deadline_at, s.answered_count)

  const db = createServiceClient()
  const { error } = await db
    .from('naale_sessions')
    .update({ ended_at: new Date().toISOString(), completed })
    .eq('id', s.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    answered_count: s.answered_count,
    completed,
    min_answers: MIN_ANSWERS_FOR_COMPLETION,
    already_ended: false,
  })
}
