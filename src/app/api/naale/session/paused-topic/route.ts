import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { canPause, isPaused, remainingMs, TOPIC_SESSION_MINUTES } from '@/lib/naale/session'

/**
 * Whether the authenticated student has a paused topic session right now, and
 * which topic it belongs to — what the "Practice by topic" dashboard uses to
 * show a remaining-time badge on the one card it applies to
 * (naale-topic-card-resume-badge). Read-only: unlike session/start, this
 * never settles stale sessions or mutates anything, since a dashboard load
 * should never have side effects on session state.
 */
export async function GET() {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data: live } = await db
    .from('naale_sessions')
    .select('kind, topic, deadline_at, paused_remaining_ms')
    .eq('student_id', session.student.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)

  const existing = live?.[0]
  if (!existing || !canPause(existing) || !isPaused(existing)) {
    return NextResponse.json({ topic: null })
  }

  return NextResponse.json({
    topic: existing.topic,
    seconds_remaining: Math.ceil(remainingMs(existing) / 1000),
    // The dashboard's progress bar needs the max to compute a fraction —
    // TOPIC_SESSION_MINUTES lives server-side, same as every other session
    // timing constant, so the client never hardcodes it.
    total_seconds: TOPIC_SESSION_MINUTES * 60,
  })
}
