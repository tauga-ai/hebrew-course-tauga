import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession } from '@/lib/naale/session'
import { getPlacementQuestions } from '@/lib/naale/placement'
import { publicFields } from '@/lib/naale/open-grading'

// Dev-only QA hint, same gate as the practice /next route — DevPanel lets a
// tester toggle whether to actually display it, but the field itself is only
// ever present when NEXT_PUBLIC_DEBUG_MODE is true at build time, never on
// anything client-supplied.
const debugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'

/**
 * The next unanswered placement question, in the fixed one-per-topic order
 * getPlacementQuestions() returns — no rotation, no adaptivity, unlike the
 * practice /next route. `question_number`/`total` give the UI a real
 * denominator, unlike practice (which has none — see ticket 10).
 */
export async function GET(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })

  const owned = await loadOwnedSession(sessionId, session.student.id)
  if (!owned.ok || owned.session.kind !== 'placement') {
    return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })
  }
  if (owned.session.ended_at) return NextResponse.json({ done: true })

  const questions = await getPlacementQuestions()
  if (questions.length === 0) return NextResponse.json({ done: true, reason: 'no_topics' })

  const db = createServiceClient()
  const [{ data: answered }, { data: openAnswered }] = await Promise.all([
    db.from('naale_answers').select('question_id').eq('session_id', sessionId),
    db.from('naale_open_answers').select('question_id').eq('session_id', sessionId),
  ])
  const answeredIds = new Set([...(answered ?? []), ...(openAnswered ?? [])].map(a => a.question_id))

  const index = questions.findIndex(q => !answeredIds.has(q.id))
  if (index === -1) return NextResponse.json({ done: true })

  const picked = questions[index]
  // Stripped in production: JSON.stringify omits an explicit `undefined`
  // value, so the key is genuinely absent from the response, not just empty.
  // For an 'open' question, the same concern applies to grading-only fields
  // — publicFields() is the allowlist, same as correct_answer for 'mcq'.
  const served = debugMode
    ? picked
    : picked.kind === 'mcq'
      ? { ...picked, correct_answer: undefined }
      : { ...picked, fields: publicFields(picked.topic as string, picked.fields as Record<string, string>) }

  return NextResponse.json({
    question: served,
    question_number: index + 1,
    total: questions.length,
  })
}
