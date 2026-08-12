import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isExpired } from '@/lib/naale/session'
import { getReviewQuestionIds } from '@/lib/naale/review-queue'

// Dev-only QA hint, same gate as /next — see that route's comment.
const isDev = process.env.NODE_ENV === 'development'

/**
 * The next review question for this session — ticket 15's session-opener:
 * 2-3 hard exercises from the student's previous practice session, served
 * before any new material. A separate route from /next (task.md Section
 * 3.1) rather than a stored phase flag, so /next itself stays untouched.
 *
 * `{ done: true }` means "nothing left to review" — the client falls
 * through to /next as normal. That includes: placement sessions (nothing to
 * review yet), a first-ever practice session (no previous session to pull
 * from), and once all queued review questions have been answered.
 */
export async function GET(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })

  const owned = await loadOwnedSession(sessionId, session.student.id)
  if (!owned.ok) return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })

  if (owned.session.ended_at || isExpired(owned.session.deadline_at)) {
    return NextResponse.json({ done: true })
  }

  // Placement never reviews — the client only calls this route for practice
  // sessions anyway, but re-checked here since routing isn't the boundary.
  if (owned.session.kind !== 'practice') {
    return NextResponse.json({ done: true })
  }

  const db = createServiceClient()

  const [reviewQueue, { data: answeredThisSession }] = await Promise.all([
    getReviewQuestionIds(session.student.id, sessionId),
    db.from('naale_answers').select('question_id').eq('session_id', sessionId).eq('is_review', true),
  ])

  const answeredIds = new Set((answeredThisSession ?? []).map(a => a.question_id))
  const remaining = reviewQueue.filter(id => !answeredIds.has(id))

  if (remaining.length === 0) {
    return NextResponse.json({ done: true })
  }

  const { data: question } = await db
    .from('naale_questions')
    .select('id, topic, difficulty, prompt, answer_kind, options, correct_answer')
    .eq('id', remaining[0])
    .maybeSingle()

  // The question was removed from the bank since last session (or the
  // import upserted a new id for edited text — see naale_questions' comment
  // on upsert-by-(topic, prompt)). Skip it rather than error; the client
  // falls through to /next.
  if (!question) {
    return NextResponse.json({ done: true })
  }

  return NextResponse.json({
    question: isDev ? { ...question, is_review: true } : { ...question, correct_answer: undefined, is_review: true },
  })
}
