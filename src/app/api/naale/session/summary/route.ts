import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession } from '@/lib/naale/session'
import { buildSessionProgress } from '@/lib/naale/stats'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'
import { generateSessionSummary } from '@/lib/naale/session-summary-ai'
import {
  rankSessionTopics,
  SESSION_SUMMARY_FALLBACK,
  SESSION_SUMMARY_FALLBACK_ICON,
} from '@/lib/naale/session-summary'

/**
 * Noam's AI end-of-session note
 * (.claude/resources/Developer_Instructions_Session_Summary_Clean.md).
 *
 * Deliberately its own route rather than part of POST /session/end. The
 * generating call can take seconds, and session/end is what paints the
 * student's XP, coins and streak — blocking it on Gemini would put a spinner
 * in front of rewards they have already earned. The recap renders complete
 * without this, and the note arrives after.
 *
 * Every failure below returns 200 with the hardcoded fallback rather than an
 * error status: the spec's requirement is an unbroken completion screen, and
 * there is nothing useful a client can do with a 429 or a 500 here. None of
 * those paths persist, so a later attempt can still produce a real note
 * instead of freezing the fallback into the row.
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

  // The id comes from the client, so ownership is re-derived rather than
  // trusted — without this, guessing a uuid would leak another student's
  // performance summary.
  const owned = await loadOwnedSession(session_id, session.student.id)
  if (!owned.ok) return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })
  const s = owned.session

  // Placement is calibration, and its screen promises "אין ציון ואין לחץ זמן"
  // — a note pointing out weak topics contradicts that directly. A session
  // still running has nothing to summarise yet. Placement also has its own
  // page and finish route, so in practice neither reaches here; this is the
  // server-side guarantee, not the only guard.
  // Topic sessions never get an AI summary — the spec's End Screen for a
  // 5-minute session shows only raw stats (naale-topic-based-sessions).
  if (s.kind === 'placement' || s.kind === 'topic' || !s.ended_at) {
    return NextResponse.json({ summary_text: null, ui_icon: null })
  }

  const fallback = {
    summary_text: SESSION_SUMMARY_FALLBACK,
    ui_icon: SESSION_SUMMARY_FALLBACK_ICON,
  }

  const db = createServiceClient()

  // Read the stored note HERE rather than widening loadOwnedSession()'s
  // select. That helper backs ten Naale routes (placement/next, answer,
  // translate, status, end, ...), so naming a new column in it makes every
  // one of them fail until the migration has run — a deploy-order trap that
  // took the whole placement flow down in local testing before this was
  // split out. Confining the new columns to their one real consumer means
  // the migration and the code can land in either order.
  const { data: stored } = await db
    .from('naale_sessions')
    .select('summary_text, summary_icon')
    .eq('id', s.id)
    .maybeSingle<{ summary_text: string | null; summary_icon: string | null }>()

  // Already generated: return the stored text. Regenerating at temperature
  // 0.4 would word the same session differently, so a reload would visibly
  // rewrite what the student was already told.
  if (stored?.summary_text) {
    return NextResponse.json({
      summary_text: stored.summary_text,
      ui_icon: stored.summary_icon ?? SESSION_SUMMARY_FALLBACK_ICON,
    })
  }
  const [{ data: answers }, { data: openAnswers }] = await Promise.all([
    db.from('naale_answers')
      .select('is_correct, topic, level_at_answer')
      .eq('session_id', s.id).eq('is_review', false),
    db.from('naale_open_answers')
      .select('score, topic, level_at_answer')
      .eq('session_id', s.id).eq('is_review', false),
  ])

  // A session with no answers has nothing to say something personal about.
  if (!answers?.length && !openAnswers?.length) return NextResponse.json(fallback)

  // Same per-topic aggregation the recap's "by topic" step already shows, so
  // the note and the numbers underneath it can never disagree.
  const { topics } = buildSessionProgress(s.id, s.kind, s.completed, answers ?? [], openAnswers ?? [])
  const ranking = rankSessionTopics(topics)

  // Shares the one AI budget with grading (15 requests / 3 min per student),
  // so a student mid-practice can't be locked out of grading by summaries.
  const limit = await checkAiRateLimit(session.student.id, 'naale-session-summary')
  if (!limit.ok) return NextResponse.json(fallback)

  try {
    const summary = await generateSessionSummary(ranking)
    const { error } = await db
      .from('naale_sessions')
      .update({ summary_text: summary.summary_text, summary_icon: summary.ui_icon })
      .eq('id', s.id)
    // A failed write is not worth failing the response over — the student
    // still gets a real note now, and the next request regenerates.
    if (error) console.error('[session-summary] failed to persist summary:', error)
    return NextResponse.json(summary)
  } catch {
    // generateSessionSummary() has already logged the specific cause.
    return NextResponse.json(fallback)
  }
}
