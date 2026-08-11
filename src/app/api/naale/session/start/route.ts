import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { SESSION_MINUTES, isExpired, secondsRemaining } from '@/lib/naale/session'

/**
 * Starts (or resumes) the authenticated student's 30-minute session.
 *
 * Idempotent by design: if the student already has a live, un-ended session,
 * that one is returned instead of creating a second. Two overlapping sessions
 * would double-count answers toward the completion minimum and make "the
 * previous session" ambiguous for the review-opener later.
 *
 * deadline_at is computed HERE, server-side, and never accepted from the
 * client — that's what makes the 30 minutes un-extendable by a reload.
 */
export async function POST() {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()

  // Resume a still-live session rather than starting a second one.
  const { data: live } = await db
    .from('naale_sessions')
    .select('id, kind, deadline_at, answered_count')
    .eq('student_id', session.student.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)

  const existing = live?.[0]
  if (existing && !isExpired(existing.deadline_at)) {
    return NextResponse.json({
      session_id: existing.id,
      kind: existing.kind,
      deadline_at: existing.deadline_at,
      seconds_remaining: secondsRemaining(existing.deadline_at),
      answered_count: existing.answered_count,
      resumed: true,
    })
  }

  // A student with no topic levels yet has never been placed. The placement
  // flow itself is ticket 11 — this only reports which kind is needed so the
  // client knows which screen to show.
  const { count: levelCount } = await db
    .from('naale_topic_levels')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', session.student.id)

  const kind = (levelCount ?? 0) === 0 ? 'placement' : 'practice'
  const deadline = new Date(Date.now() + SESSION_MINUTES * 60 * 1000).toISOString()

  const { data: created, error } = await db
    .from('naale_sessions')
    .insert({ student_id: session.student.id, kind, deadline_at: deadline })
    .select('id, kind, deadline_at, answered_count')
    .single()

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? 'שגיאה בפתיחת תרגול' }, { status: 500 })
  }

  return NextResponse.json({
    session_id: created.id,
    kind: created.kind,
    deadline_at: created.deadline_at,
    seconds_remaining: secondsRemaining(created.deadline_at),
    answered_count: created.answered_count,
    resumed: false,
  })
}
