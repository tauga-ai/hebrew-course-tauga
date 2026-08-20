import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { SESSION_MINUTES, isExpired, isSessionCompleted, secondsRemaining, readDevSessionMinutesOverride } from '@/lib/naale/session'
import { selectAll } from '@/lib/naale/paginate'

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

  // Settle any expired-but-unended sessions before anything else. A session
  // abandoned by closing the tab keeps ended_at null and its `completed`
  // value never gets evaluated — /session/end is the only other place that
  // sets it, and an abandoned session never calls it. Left unsettled, ticket
  // 14's XP-completion-bonus and weekly streak would silently undercount,
  // since both only look at completed sessions. No cron job needed: this
  // runs lazily, the next time the student starts anything.
  const stale = await selectAll<{ id: string; deadline_at: string; answered_count: number }>('naale_sessions', (from, to) =>
    db.from('naale_sessions')
      .select('id, deadline_at, answered_count')
      .eq('student_id', session.student.id)
      .is('ended_at', null)
      .range(from, to))

  for (const s of stale) {
    if (isExpired(s.deadline_at)) {
      await db
        .from('naale_sessions')
        .update({
          ended_at: new Date().toISOString(),
          completed: isSessionCompleted(s.deadline_at, s.answered_count),
        })
        .eq('id', s.id)
    }
  }

  // Dev-only QA convenience (DevPanel's "Session length override" field): a
  // client cookie can ask for any length, and only takes effect when debugMode
  // is true, server-side — NEXT_PUBLIC_DEBUG_MODE is baked in at build time,
  // so this cookie has zero effect against a build where it's off, regardless
  // of what a client sends.
  const overrideMinutes = await readDevSessionMinutesOverride()

  // Resume a still-live session rather than starting a second one.
  const { data: live } = await db
    .from('naale_sessions')
    .select('id, kind, deadline_at, answered_count, started_at')
    .eq('student_id', session.student.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)

  const existing = live?.[0]
  if (existing && !isExpired(existing.deadline_at)) {
    // Dev-only: if the QA override changed since this session was created
    // (or was set for the first time after it), make the resumed session
    // reflect it instead of always keeping whatever deadline was computed at
    // creation time — recomputed from started_at, so this can shorten OR
    // extend the deadline without resetting the clock or touching
    // answered_count.
    let deadline_at = existing.deadline_at
    if (overrideMinutes !== null) {
      const recomputed = new Date(new Date(existing.started_at).getTime() + overrideMinutes * 60 * 1000).toISOString()
      if (recomputed !== existing.deadline_at) {
        await db.from('naale_sessions').update({ deadline_at: recomputed }).eq('id', existing.id)
        deadline_at = recomputed
      }
    }

    return NextResponse.json({
      session_id: existing.id,
      kind: existing.kind,
      deadline_at,
      seconds_remaining: secondsRemaining(deadline_at),
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

  const minutes = overrideMinutes ?? SESSION_MINUTES
  const deadline = new Date(Date.now() + minutes * 60 * 1000).toISOString()

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
