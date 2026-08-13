import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { debugMode } from '@/lib/dev-i18n'

/**
 * Debug-only: instantly sets the caller's active session's deadline_at to
 * now, so the timer-expiry path (session/next returning
 * { done: true, reason: 'time_up' }) can be tested without waiting out even
 * the shortened session-length override.
 *
 * Deliberately does NOT set ended_at/completed itself — that's
 * auto-complete's job, and is exactly what makes these two tools test two
 * different end states. The next real request that checks the deadline
 * (session/next, session/end) settles those fields the same way it would
 * for a session that expired naturally.
 */
export async function POST() {
  if (!debugMode) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data: active } = await db
    .from('naale_sessions')
    .select('id')
    .eq('student_id', session.student.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!active) return NextResponse.json({ error: 'no active session' }, { status: 400 })

  const deadline_at = new Date().toISOString()
  await db.from('naale_sessions').update({ deadline_at }).eq('id', active.id)

  return NextResponse.json({ session_id: active.id, deadline_at })
}
