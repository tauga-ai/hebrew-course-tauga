import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isExpired } from '@/lib/naale/session'
import { applyAnswer, MIN_LEVEL } from '@/lib/naale/leveling'
import { isAnswerCorrect } from '@/lib/naale/grading'

/**
 * Grades one answer, logs the attempt, and re-levels the topic — all in this
 * request, so the next /next call already reflects the new level (the spec's
 * "everything updates in real time" requirement).
 *
 * Grading happens here and only here: /next never sends correct_answer to the
 * browser, so the client cannot know correctness before submitting.
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
  if (!session_id || !question_id || answer === undefined || answer === null) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }

  const owned = await loadOwnedSession(session_id, session.student.id)
  if (!owned.ok) return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })

  // A late answer must not count. The deadline is server-authoritative, so a
  // paused tab or a tampered clock can't sneak one in.
  if (owned.session.ended_at || isExpired(owned.session.deadline_at)) {
    return NextResponse.json({ error: 'הזמן נגמר' }, { status: 409 })
  }

  const db = createServiceClient()

  const { data: question } = await db
    .from('naale_questions')
    .select('id, topic, difficulty, answer_kind, correct_answer')
    .eq('id', question_id)
    .maybeSingle()

  if (!question) return NextResponse.json({ error: 'שאלה לא נמצאה' }, { status: 404 })

  // Answering the same question twice would double-count the streak and inflate
  // answered_count toward the 3-question completion minimum.
  const { data: alreadyAnswered } = await db
    .from('naale_answers')
    .select('id')
    .eq('student_id', session.student.id)
    .eq('question_id', question_id)
    .maybeSingle()

  if (alreadyAnswered) {
    return NextResponse.json({ error: 'כבר ענית על שאלה זו' }, { status: 409 })
  }

  const isCorrect = isAnswerCorrect(String(answer), question.correct_answer, question.answer_kind)

  // Loaded by (student_id, topic) — THIS is what makes the streak per-topic.
  // applyAnswer() only ever sees one topic's state and cannot enforce it itself.
  const { data: levelRow } = await db
    .from('naale_topic_levels')
    .select('level, correct_streak, wrong_streak, answered_count')
    .eq('student_id', session.student.id)
    .eq('topic', question.topic)
    .maybeSingle()

  const before = levelRow
    ? { level: levelRow.level, correct_streak: levelRow.correct_streak, wrong_streak: levelRow.wrong_streak }
    : { level: MIN_LEVEL, correct_streak: 0, wrong_streak: 0 }

  const after = applyAnswer(before, isCorrect)

  // Attempt row first: if a later write fails, a logged answer with a missed
  // level effect is recoverable, whereas a level change for an unrecorded
  // answer is not.
  const { error: answerError } = await db.from('naale_answers').insert({
    session_id,
    student_id: session.student.id,
    question_id,
    topic: question.topic,
    difficulty: question.difficulty,
    level_at_answer: before.level,
    is_correct: isCorrect,
  })
  if (answerError) return NextResponse.json({ error: answerError.message }, { status: 500 })

  const { error: levelError } = await db.from('naale_topic_levels').upsert({
    student_id: session.student.id,
    topic: question.topic,
    level: after.level,
    correct_streak: after.correct_streak,
    wrong_streak: after.wrong_streak,
    answered_count: (levelRow?.answered_count ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,topic' })
  if (levelError) return NextResponse.json({ error: levelError.message }, { status: 500 })

  await db
    .from('naale_sessions')
    .update({ answered_count: owned.session.answered_count + 1 })
    .eq('id', session_id)

  return NextResponse.json({
    is_correct: isCorrect,
    // Safe to return now — the answer has been submitted and recorded.
    correct_answer: question.correct_answer,
    level: after.level,
    level_changed: after.level !== before.level,
    answered_count: owned.session.answered_count + 1,
  })
}
