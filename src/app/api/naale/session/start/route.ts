import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { SESSION_MINUTES, TOPIC_SESSION_MINUTES, isExpired, isSessionCompleted, secondsRemaining, readDevSessionMinutesOverride, canPause, isPauseExpired, isTopicMismatch, remainingMs, resumedDeadline } from '@/lib/naale/session'
import { selectAll } from '@/lib/naale/paginate'

/**
 * Starts (or resumes) the authenticated student's session — the 30-minute
 * mixed session by default, or a 5-minute single-topic session when the
 * client posts a `topic` (naale-topic-based-sessions).
 *
 * Idempotent by design: if the student already has a live, un-ended session,
 * that one is returned instead of creating a second. Two overlapping sessions
 * would double-count answers toward the completion minimum and make "the
 * previous session" ambiguous for the review-opener later. This applies
 * regardless of kind — a student can't have a live topic session AND a live
 * practice session at once; whichever is already live wins.
 *
 * Exception (naale-topic-scoped-session-resume): a topic tap naming a
 * DIFFERENT topic than whatever's live doesn't "win" silently — it treats
 * the old one as abandoned and starts the newly-requested topic instead. See
 * isTopicMismatch()'s own comment.
 *
 * deadline_at is computed HERE, server-side, and never accepted from the
 * client — that's what makes the session length un-extendable by a reload.
 */
export async function POST(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // Absent or empty body means the existing 30-minute mixed session — every
  // call site that predates this ticket sends no body at all, so this must
  // tolerate that rather than requiring JSON.
  let topic: string | null = null
  // 'resume' / 'start_over' answer the returning-student prompt
  // (naale-topic-session-resume). Validated against the literal set rather than
  // passed through: it selects a branch below, so an unrecognised value must
  // fall back to the default path, never reach a switch it wasn't meant to.
  let action: 'resume' | 'start_over' | undefined
  try {
    const body = await req.json()
    topic = typeof body?.topic === 'string' && body.topic.trim() ? body.topic.trim() : null
    action = body?.action === 'resume' || body?.action === 'start_over' ? body.action : undefined
  } catch {
    // No body / invalid JSON — treat as the plain 30-minute start.
  }

  const db = createServiceClient()

  // Settle any expired-but-unended sessions before anything else. A session
  // abandoned by closing the tab keeps ended_at null and its `completed`
  // value never gets evaluated — /session/end is the only other place that
  // sets it, and an abandoned session never calls it. Left unsettled, ticket
  // 14's XP-completion-bonus and weekly streak would silently undercount,
  // since both only look at completed sessions. No cron job needed: this
  // runs lazily, the next time the student starts anything.
  const stale = await selectAll<{
    id: string; deadline_at: string; answered_count: number; paused_remaining_ms: number | null; paused_at: string | null
  }>('naale_sessions', (from, to) =>
    db.from('naale_sessions')
      .select('id, deadline_at, answered_count, paused_remaining_ms, paused_at')
      .eq('student_id', session.student.id)
      .is('ended_at', null)
      .range(from, to))

  for (const s of stale) {
    // A PAUSED session's deadline_at is frozen in the past by construction
    // (naale-topic-session-resume) — that is how banking the remainder works.
    // Without this guard the sweep would close exactly the sessions the resume
    // flow exists to preserve, and the failure would be silent: no error, no
    // log, just "resume does nothing". Highest-risk line in that ticket.
    if (s.paused_remaining_ms !== null) {
      // Only a bank old enough to have expired gets closed here
      // (naale-paused-session-expiry) — anything still inside the window is
      // left alone for session/start's resumable-offer branch to find further
      // down.
      if (isPauseExpired(s)) {
        await db
          .from('naale_sessions')
          .update({
            ended_at: new Date().toISOString(),
            completed: isSessionCompleted(s.deadline_at, s.answered_count),
          })
          .eq('id', s.id)
      }
      continue
    }
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
    .select('id, kind, topic, deadline_at, answered_count, started_at, paused_remaining_ms')
    .eq('student_id', session.student.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)

  const existing = live?.[0]

  // --- naale-topic-scoped-session-resume ------------------------------------
  // A plain topic tap that names a DIFFERENT topic than whatever's already
  // live treats the old session as abandoned instead of offering to resume
  // it — Noam: Resume should only ever be offered for the exact topic left
  // unfinished. Computed before the resumable-offer branch below (it gates
  // that branch) AND excluded from the "hand existing back" branch further
  // down (~line 185, alongside the existing action === 'start_over'
  // exclusion) — closing a session here only updates the database, not the
  // `existing` object already read into memory, so without that second
  // exclusion a student could still be handed back a session just closed a
  // few lines above.
  const topicMismatch = isTopicMismatch(existing, topic, action)

  if (topicMismatch && existing) {
    // Same close-out the explicit start_over branch below uses — this IS an
    // implicit start-over, just one nobody had to choose.
    const { error } = await db
      .from('naale_sessions')
      .update({
        ended_at: new Date().toISOString(),
        completed: isSessionCompleted(existing.deadline_at, existing.answered_count),
        paused_remaining_ms: null,
      })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Falls through to the normal creation path below, which starts a fresh
    // session on the topic requested in this same request body.
  }
  // --------------------------------------------------------------------------

  // --- naale-topic-session-resume -------------------------------------------
  // An unfinished PAUSABLE session is offered back rather than silently
  // resumed: Noam asked for an explicit Resume / Start Over choice ("they
  // shouldn't be forced to finish that old session"). Everything else keeps
  // resuming silently, which is the existing behaviour and the only one the
  // 30-minute session has — it has no start-over affordance at all, by his
  // explicit instruction.
  //
  // Note this branch sits BEFORE the isExpired() check below on purpose: a
  // paused session's deadline_at is frozen in the past, so it would otherwise
  // fall through and be treated as expired.
  if (existing && canPause(existing) && action === undefined && !topicMismatch) {
    return NextResponse.json({
      resumable: {
        session_id: existing.id,
        topic: existing.topic,
        seconds_remaining: Math.ceil(remainingMs(existing) / 1000),
        answered_count: existing.answered_count,
      },
    })
  }

  if (existing && canPause(existing) && action === 'resume') {
    // The clock restarts from whatever was banked. If the student was never
    // detected leaving (a crash, a dead battery), remainingMs() falls back to
    // the live deadline, so they resume with whatever genuinely remains rather
    // than with a full timer.
    const deadline_at = resumedDeadline(remainingMs(existing))

    const { error } = await db
      .from('naale_sessions')
      .update({ deadline_at, paused_remaining_ms: null })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      session_id: existing.id,
      kind: existing.kind,
      topic: existing.topic,
      deadline_at,
      seconds_remaining: secondsRemaining(deadline_at),
      answered_count: existing.answered_count,
      resumed: true,
    })
  }

  // A resume with nothing to resume must NOT fall through to the creation path
  // below. It did, and the consequences were invisible: resumeClock() on the
  // session page posts action:'resume' with NO topic, so every such call minted
  // a fresh session — `kind` resolving to 'practice' because `topic` was null.
  // The client fires that call on every return-to-tab, so a session that had
  // already ended spawned a brand new one on each switch, silently, several
  // per minute (observed 2026-08-27: repeated "clock resumed
  // {seconds_remaining: 300}" — a FULL session, not a banked remainder, which
  // is what gave it away).
  //
  // 409 rather than an error page: the client's resume handler already treats a
  // non-ok response as "go back to the dashboard", which is exactly right —
  // whatever it meant to resume is gone, and the dashboard is where a student
  // finds out what they actually have.
  if (action === 'resume' && !(existing && canPause(existing))) {
    return NextResponse.json({ error: 'no_resumable_session' }, { status: 409 })
  }

  if (existing && canPause(existing) && action === 'start_over') {
    // Ends the old session with the same close-out the stale sweep uses, so a
    // session that genuinely ran its timer still counts as completed. The
    // ANSWERS are untouched: XP and coins are derived from naale_answers rather
    // than stored, so everything earned before the interruption survives —
    // Noam's "any questions they already completed before quitting still count,
    // of course". Start Over discards the session, not the work.
    const { error } = await db
      .from('naale_sessions')
      .update({
        ended_at: new Date().toISOString(),
        completed: isSessionCompleted(existing.deadline_at, existing.answered_count),
        paused_remaining_ms: null,
      })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Falls through to the normal creation path below, which will start a
    // fresh session on the topic requested in this same request body.
  }
  // --------------------------------------------------------------------------

  if (existing && !isExpired(existing.deadline_at) && !(canPause(existing) && (action === 'start_over' || topicMismatch))) {
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
      topic: existing.topic,
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

  // A topic session requires placement first, same precondition the 30-minute
  // session already has — a topic's difficulty progression has nothing to key
  // off before a student has been placed (resolved without asking Noam, see
  // ticket.md's "Resolved without asking Noam" note: nextSessionKind() already
  // gates the 30-minute session the same way).
  if (topic && (levelCount ?? 0) === 0) {
    return NextResponse.json({ error: 'יש להשלים מבחן התאמה לפני תרגול לפי נושא' }, { status: 400 })
  }

  if (topic) {
    const [{ count: mcqCount }, { count: openCount }] = await Promise.all([
      db.from('naale_questions').select('id', { count: 'exact', head: true }).eq('topic', topic),
      db.from('naale_open_questions').select('id', { count: 'exact', head: true }).eq('topic', topic),
    ])
    if ((mcqCount ?? 0) === 0 && (openCount ?? 0) === 0) {
      return NextResponse.json({ error: 'נושא לא נמצא' }, { status: 400 })
    }
  }

  const kind = topic ? 'topic' : (levelCount ?? 0) === 0 ? 'placement' : 'practice'

  const minutes = overrideMinutes ?? (topic ? TOPIC_SESSION_MINUTES : SESSION_MINUTES)
  const deadline = new Date(Date.now() + minutes * 60 * 1000).toISOString()

  const { data: created, error } = await db
    .from('naale_sessions')
    .insert({ student_id: session.student.id, kind, topic, deadline_at: deadline })
    .select('id, kind, topic, deadline_at, answered_count')
    .single()

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? 'שגיאה בפתיחת תרגול' }, { status: 500 })
  }

  return NextResponse.json({
    session_id: created.id,
    kind: created.kind,
    topic: created.topic,
    deadline_at: created.deadline_at,
    seconds_remaining: secondsRemaining(created.deadline_at),
    answered_count: created.answered_count,
    resumed: false,
  })
}
