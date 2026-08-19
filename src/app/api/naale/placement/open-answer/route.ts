import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession } from '@/lib/naale/session'
import { gradeOpenAnswer } from '@/lib/naale/open-grading'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'

/**
 * Records one placement answer for an AI-graded (free-text) topic. Mirrors
 * placement/answer/route.ts exactly (grade and log, no leveling call —
 * placement levels are all set at once by /placement/finish), swapping MCQ
 * grading for the Gemini call and adding the shared AI rate limit.
 */
export async function POST(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let session_id: string, question_id: string, user_text: string
  try {
    ({ session_id, question_id, user_text } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }
  if (!session_id || !question_id || !user_text?.trim()) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }

  const owned = await loadOwnedSession(session_id, session.student.id)
  if (!owned.ok || owned.session.kind !== 'placement') {
    return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })
  }

  if (!(await checkAiRateLimit(session.student.id, 'naale/placement-open-answer')).ok) {
    return NextResponse.json({ error: 'יותר מדי בקשות, נסה שוב בעוד כמה דקות' }, { status: 429 })
  }

  const db = createServiceClient()
  const { data: question } = await db
    .from('naale_open_questions')
    .select('id, topic, difficulty, prompt, fields')
    .eq('id', question_id)
    .maybeSingle()
  if (!question) return NextResponse.json({ error: 'שאלה לא נמצאה' }, { status: 404 })

  // Same duplicate-submit guard as session/open-answer/route.ts — a fast
  // double-click here previously fell all the way through to the unique
  // constraint below and surfaced as a raw 500 instead of a clean 409 (the
  // exact bug the naale-whatsapp-messages QA pass caught and diagnosed).
  // Checked before the Gemini call so a double-click doesn't also burn a
  // second grading request.
  const { data: answeredThisSession } = await db
    .from('naale_open_answers')
    .select('id')
    .eq('session_id', session_id)
    .eq('question_id', question_id)
    .maybeSingle()
  if (answeredThisSession) {
    return NextResponse.json({ error: 'כבר ענית על שאלה זו', code: 'duplicate_answer' }, { status: 409 })
  }

  let graded: { score: number; feedback: string }
  try {
    graded = await gradeOpenAnswer(question.topic, question.prompt, question.fields as Record<string, string>, user_text)
  } catch (err) {
    console.error('Naale placement open-answer grading error:', err)
    return NextResponse.json({ error: 'שגיאה בבדיקת התשובה, נסה שוב' }, { status: 502 })
  }

  const { error } = await db.from('naale_open_answers').insert({
    session_id,
    student_id: session.student.id,
    question_id,
    topic: question.topic,
    difficulty: question.difficulty,
    level_at_answer: question.difficulty,
    user_text,
    score: graded.score,
    feedback: graded.feedback,
  })
  if (error) {
    // Same DB-level backstop as naale_answers_session_question_unique — see
    // that migration's comment for the concurrent-request race this catches
    // on top of the pre-check above.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'כבר ענית על שאלה זו', code: 'duplicate_answer' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await db
    .from('naale_sessions')
    .update({ answered_count: owned.session.answered_count + 1 })
    .eq('id', session_id)

  return NextResponse.json({ score: graded.score, feedback: graded.feedback })
}
