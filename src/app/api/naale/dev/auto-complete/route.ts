import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { debugMode } from '@/lib/dev-i18n'

/**
 * Debug-only: marks the caller's active session completed directly —
 * bypasses the real completion rule (reached the timer AND answered at
 * least MIN_ANSWERS_FOR_COMPLETION), so the "finished normally" end state
 * can be tested without answering enough real questions first.
 *
 * A distinct end state from force-expire: that one drives the session
 * toward the time_up path with completed left for the normal settle logic
 * to decide; this one goes straight to completed: true regardless of
 * answered_count.
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

  const ended_at = new Date().toISOString()
  await db.from('naale_sessions').update({ completed: true, ended_at }).eq('id', active.id)

  return NextResponse.json({ session_id: active.id, completed: true, ended_at })
}
