import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { debugMode } from '@/lib/dev-i18n'

/**
 * Debug-only: the caller's own currently-active (un-ended) Naale session, if
 * any. Powers the Dev Panel's raw session readout, and is what force-expire/
 * auto-complete look up before acting — there's no other "find my current
 * session" endpoint (session/status/route.ts needs the session_id already
 * known, it can't discover it).
 *
 * 404s whenever debugMode is off, exactly like every other debug-only
 * route here — never trust that the Dev Panel button being hidden
 * client-side is the only thing standing between this and a real request.
 */
export async function GET() {
  if (!debugMode) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data } = await db
    .from('naale_sessions')
    .select('id, deadline_at, kind, answered_count, paused_remaining_ms')
    .eq('student_id', session.student.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return NextResponse.json({ active: null })

  return NextResponse.json({
    active: {
      session_id: data.id,
      deadline_at: data.deadline_at,
      kind: data.kind,
      answered_count: data.answered_count,
      // Otherwise invisible state, and the one that decides whether a topic
      // session is paused (naale-topic-session-resume). Without it on screen
      // there's no way to tell "the pause never fired" from "the pause fired
      // and something downstream ate it" — a distinction that cost a live
      // debugging session to establish once already.
      paused_remaining_ms: data.paused_remaining_ms,
    },
  })
}
