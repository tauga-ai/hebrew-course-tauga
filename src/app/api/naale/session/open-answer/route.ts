import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isExpired } from '@/lib/naale/session'
import { applyGradedAnswer, MIN_LEVEL } from '@/lib/naale/leveling'
import { gradeOpenAnswer } from '@/lib/naale/open-grading'
import { consecutiveGoodScoreStreak, STREAK_MILESTONES } from '@/lib/naale/rewards'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'
import { getOpenReviewQuestionIds } from '@/lib/naale/open-review-queue'

/**
 * Grades one free-text answer (AI-scored 1-5, not exact-match), logs the
 * attempt, and re-levels the topic — mirrors session/answer/route.ts's
 * shape (auth → ownership/expiry → duplicate checks → grade → log → level →
 * session count), swapping MCQ grading for the Gemini call and adding the
 * shared AI rate limit + streak-milestone signal.
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
  if (!owned.ok) return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })
  if (owned.session.ended_at || isExpired(owned.session.deadline_at)) {
    return NextResponse.json({ error: 'הזמן נגמר', code: 'expired' }, { status: 409 })
  }

  if (!(await checkAiRateLimit(session.student.id, 'naale/open-answer')).ok) {
    return NextResponse.json({ error: 'יותר מדי בקשות, נסה שוב בעוד כמה דקות' }, { status: 429 })
  }

  const db = createServiceClient()

  const [{ data: question }, { data: answeredThisSession }, { data: answeredEver }, reviewQueue] = await Promise.all([
    db.from('naale_open_questions').select('id, topic, difficulty, prompt, fields').eq('id', question_id).maybeSingle(),
    db.from('naale_open_answers').select('id').eq('session_id', session_id).eq('question_id', question_id).maybeSingle(),
    db.from('naale_open_answers').select('id').eq('student_id', session.student.id).eq('question_id', question_id).maybeSingle(),
    getOpenReviewQuestionIds(session.student.id, session_id),
  ])

  if (!question) return NextResponse.json({ error: 'שאלה לא נמצאה' }, { status: 404 })
  if (answeredThisSession) {
    return NextResponse.json({ error: 'כבר ענית על שאלה זו', code: 'duplicate_answer' }, { status: 409 })
  }
  const isSanctionedReview = reviewQueue.includes(question_id)
  if (answeredEver && !isSanctionedReview) {
    return NextResponse.json({ error: 'כבר ענית על שאלה זו', code: 'duplicate_answer' }, { status: 409 })
  }

  let graded: { score: number; feedback: string }
  try {
    graded = await gradeOpenAnswer(question.topic, question.prompt, question.fields as Record<string, string>, user_text)
  } catch (err) {
    console.error('Naale open-answer grading error:', err)
    return NextResponse.json({ error: 'שגיאה בבדיקת התשובה, נסה שוב' }, { status: 502 })
  }

  const { data: levelRow } = await db
    .from('naale_topic_levels')
    .select('level, correct_streak, wrong_streak, answered_count')
    .eq('student_id', session.student.id)
    .eq('topic', question.topic)
    .maybeSingle()

  const before = levelRow
    ? { level: levelRow.level, correct_streak: levelRow.correct_streak, wrong_streak: levelRow.wrong_streak }
    : { level: MIN_LEVEL, correct_streak: 0, wrong_streak: 0 }
  // Same working decision as MCQ review answers: graded, recorded, but never
  // moves the level — it's re-shown because it scored poorly.
  const after = isSanctionedReview ? before : applyGradedAnswer(before, graded.score)

  const { error: answerError } = await db.from('naale_open_answers').insert({
    session_id,
    student_id: session.student.id,
    question_id,
    topic: question.topic,
    difficulty: question.difficulty,
    level_at_answer: before.level,
    user_text,
    score: graded.score,
    feedback: graded.feedback,
    is_review: isSanctionedReview,
  })
  if (answerError) {
    // Same DB-level backstop as naale_answers_session_question_unique — see
    // that migration's comment for the concurrent-request race it closes.
    if (answerError.code === '23505') {
      return NextResponse.json({ error: 'כבר ענית על שאלה זו', code: 'duplicate_answer' }, { status: 409 })
    }
    return NextResponse.json({ error: answerError.message }, { status: 500 })
  }

  if (!isSanctionedReview) {
    await db.from('naale_topic_levels').upsert({
      student_id: session.student.id,
      topic: question.topic,
      level: after.level,
      correct_streak: after.correct_streak,
      wrong_streak: after.wrong_streak,
      answered_count: (levelRow?.answered_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,topic' })

    await db.from('naale_sessions').update({ answered_count: owned.session.answered_count + 1 }).eq('id', session_id)
  }

  // Milestone check: this student's most recent graded answers (any of the 3
  // topics, non-review), including the one just inserted. Fetches more rows
  // than the largest milestone (10) — capping the fetch AT 10 would make
  // consecutiveGoodScoreStreak() unable to tell a streak of exactly 10 apart
  // from one of 15, so the "10 in a row" celebration would silently refire
  // on every answer after the 10th instead of firing once.
  let milestone: number | null = null
  if (!isSanctionedReview) {
    const { data: recent } = await db
      .from('naale_open_answers')
      .select('score')
      .eq('student_id', session.student.id)
      .eq('is_review', false)
      .order('answered_at', { ascending: false })
      .limit(15)
    const streak = consecutiveGoodScoreStreak(recent ?? [])
    milestone = STREAK_MILESTONES.includes(streak as typeof STREAK_MILESTONES[number]) ? streak : null
  }

  return NextResponse.json({
    score: graded.score,
    feedback: graded.feedback,
    level: after.level,
    level_changed: after.level !== before.level,
    milestone,
    is_review: isSanctionedReview,
  })
}
