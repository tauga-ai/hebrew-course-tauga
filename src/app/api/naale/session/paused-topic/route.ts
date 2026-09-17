import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { canPause, isPaused, isExpired, remainingMs, secondsRemaining, TOPIC_SESSION_MINUTES } from '@/lib/naale/session'

/**
 * Whether the authenticated student has a paused topic session right now (and
 * which topic it belongs to), or a live 30-minute practice session — what the
 * "Practice by topic" dashboard uses for the topic-card resume badge
 * (naale-topic-card-resume-badge) and, as of naale-topic-session-practice-
 * conflict, what StartSessionSheet uses to warn before a topic tap would
 * silently end a live practice session. Read-only: unlike session/start, this
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

  // A live (not yet stale-swept) practice session — mutually exclusive with
  // the paused-topic case below by construction (session/start never lets a
  // student hold both kinds at once).
  const practice_live = existing && existing.kind === 'practice' && !isExpired(existing.deadline_at)
    ? { seconds_remaining: secondsRemaining(existing.deadline_at) }
    : null

  if (!existing || !canPause(existing) || !isPaused(existing)) {
    return NextResponse.json({ topic: null, practice_live })
  }

  return NextResponse.json({
    topic: existing.topic,
    seconds_remaining: Math.ceil(remainingMs(existing) / 1000),
    // The dashboard's progress bar needs the max to compute a fraction —
    // TOPIC_SESSION_MINUTES lives server-side, same as every other session
    // timing constant, so the client never hardcodes it.
    total_seconds: TOPIC_SESSION_MINUTES * 60,
    practice_live,
  })
}
