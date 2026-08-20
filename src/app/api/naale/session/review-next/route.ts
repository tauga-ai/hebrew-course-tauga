import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isExpired } from '@/lib/naale/session'
import { getSessionReviewQueue } from '@/lib/naale/review-queue'
import { publicFields } from '@/lib/naale/open-grading'

// Dev-only QA hint, same gate as /next — see that route's comment.
const debugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'

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

  // Both answer tables: the queue spans both banks, so "already reviewed this
  // session" has to as well — otherwise a graded review question would be
  // re-served on every call until the session ended.
  const [reviewQueue, { data: answeredMcq }, { data: answeredOpen }] = await Promise.all([
    getSessionReviewQueue(session.student.id, sessionId),
    db.from('naale_answers').select('question_id').eq('session_id', sessionId).eq('is_review', true),
    db.from('naale_open_answers').select('question_id').eq('session_id', sessionId).eq('is_review', true),
  ])

  const answeredIds = new Set([
    ...(answeredMcq ?? []).map(a => a.question_id),
    ...(answeredOpen ?? []).map(a => a.question_id),
  ])
  const remaining = reviewQueue.filter(entry => !answeredIds.has(entry.question_id))

  if (remaining.length === 0) {
    return NextResponse.json({ done: true })
  }

  const next = remaining[0]

  if (next.kind === 'open') {
    const { data: question } = await db
      .from('naale_open_questions')
      .select('id, topic, difficulty, prompt, fields')
      .eq('id', next.question_id)
      .maybeSingle()

    // Same missing-question handling as the MCQ branch below.
    if (!question) return NextResponse.json({ done: true })

    // publicFields() strips the grading-only keys (a model answer, anchors)
    // exactly as /next does — a review question is still an unanswered
    // question, so the same allowlist applies.
    return NextResponse.json({
      question: {
        id: question.id,
        topic: question.topic,
        difficulty: question.difficulty,
        kind: 'open',
        prompt: question.prompt,
        fields: debugMode
          ? (question.fields as Record<string, string>)
          : publicFields(question.topic, question.fields as Record<string, string>),
        is_review: true,
      },
    })
  }

  const { data: question } = await db
    .from('naale_questions')
    .select('id, topic, difficulty, prompt, answer_kind, options, correct_answer')
    .eq('id', next.question_id)
    .maybeSingle()

  // The question was removed from the bank since last session (or the
  // import upserted a new id for edited text — see naale_questions' comment
  // on upsert-by-(topic, prompt)). Skip it rather than error; the client
  // falls through to /next.
  if (!question) {
    return NextResponse.json({ done: true })
  }

  // `kind` was previously omitted here entirely. It happened to work — the
  // client's `q.kind === 'open'` check fell through to the MCQ branch — but
  // only because every review question was MCQ. Now that it isn't, the
  // discriminant is explicit on both paths.
  return NextResponse.json({
    question: debugMode
      ? { ...question, kind: 'mcq', is_review: true }
      : { ...question, kind: 'mcq', correct_answer: undefined, is_review: true },
  })
}
