import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession } from '@/lib/naale/session'
import { isAnswerCorrect } from '@/lib/naale/grading'

/**
 * Records one placement answer.
 *
 * Deliberately does NOT call applyAnswer(): during placement a correct answer
 * means "start this topic at level 3", not "advance a streak". Reusing the
 * practice answer route would also create a naale_topic_levels row on the first
 * answer — which is exactly the signal /session/start uses to decide a student
 * has already been placed, so it would end placement after one question.
 *
 * Levels are written only by /placement/finish, in one pass over all topics, so
 * an abandoned placement leaves no half-placed profile behind.
 */
export async function POST(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let session_id: string, question_id: string, answer: string
  try {
    ({ session_id, question_id, answer } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }
  if (!session_id || !question_id || answer === undefined) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }

  const owned = await loadOwnedSession(session_id, session.student.id)
  if (!owned.ok || owned.session.kind !== 'placement') {
    return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })
  }

  const db = createServiceClient()
  const { data: question } = await db
    .from('naale_questions')
    .select('id, topic, difficulty, answer_kind, correct_answer')
    .eq('id', question_id)
    .maybeSingle()

  if (!question) return NextResponse.json({ error: 'שאלה לא נמצאה' }, { status: 404 })

  const isCorrect = isAnswerCorrect(String(answer), question.correct_answer, question.answer_kind)

  const { error } = await db.from('naale_answers').insert({
    session_id,
    student_id: session.student.id,
    question_id,
    topic: question.topic,
    difficulty: question.difficulty,
    level_at_answer: question.difficulty,
    is_correct: isCorrect,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db
    .from('naale_sessions')
    .update({ answered_count: owned.session.answered_count + 1 })
    .eq('id', session_id)

  return NextResponse.json({ is_correct: isCorrect, correct_answer: question.correct_answer })
}
