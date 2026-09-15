import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isSessionExpired, isPendingQuestion } from '@/lib/naale/session'
import { applyGradedAnswer, MIN_LEVEL } from '@/lib/naale/leveling'
import { runDebateTurn } from '@/lib/naale/debate-grading'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'
import { fetchRecentGradedAnswersMilestone } from '@/lib/naale/graded-answer-milestone'
import { getSessionReviewQueue } from '@/lib/naale/review-queue'

type DebateQuestionRow = {
  question_id: string
  topic: string
  difficulty: number
  subject: string
  initial_ai_argument: string
  required_connectors: string
  expected_answer_rubric: string
  max_turns: number
}

/**
 * Grades one turn of a debate exchange — either a mid-conversation
 * counter-argument (levels 4-5's first reply) or the final whole-exchange
 * score. Mirrors session/open-answer/route.ts's shape (auth →
 * ownership/expiry → rate limit → grade → save → level → milestone), with
 * turn-detection (via naale_sessions.pending_exchange) inserted before
 * grading, since a debate exchange spans up to two of these requests before
 * anything is scored or saved.
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

  // Same soft-stop carve-out as open-answer/route.ts — see that file's
  // comment for the full reasoning. Topic sessions only.
  const isLate = isSessionExpired(owned.session)
  const softStopEligible =
    isLate && owned.session.kind === 'topic' && isPendingQuestion(owned.session, question_id)
  if (owned.session.ended_at || (isLate && !softStopEligible)) {
    return NextResponse.json({ error: 'הזמן נגמר', code: 'expired' }, { status: 409 })
  }

  if (!(await checkAiRateLimit(session.student.id, 'naale/debate-answer')).ok) {
    return NextResponse.json({ error: 'יותר מדי בקשות, נסה שוב בעוד כמה דקות' }, { status: 429 })
  }

  const db = createServiceClient()

  const [{ data: question }, { data: existingAnswer }] = await Promise.all([
    db.from('naale_debate_questions')
      .select('question_id, topic, difficulty, subject, initial_ai_argument, required_connectors, expected_answer_rubric, max_turns')
      .eq('question_id', question_id).maybeSingle<DebateQuestionRow>(),
    db.from('naale_debate_answers').select('id').eq('session_id', session_id).eq('question_id', question_id).maybeSingle(),
  ])
  if (!question) return NextResponse.json({ error: 'שאלה לא נמצאה' }, { status: 404 })
  if (existingAnswer) {
    return NextResponse.json({ error: 'כבר ענית על שאלה זו', code: 'duplicate_answer' }, { status: 409 })
  }

  const pending = owned.session.pending_exchange
  const isTurnTwo = pending?.question_id === question_id
  const isFinalTurn = question.max_turns === 1 || isTurnTwo

  let turnResult
  try {
    turnResult = await runDebateTurn({
      subject: question.subject,
      initialAiArgument: question.initial_ai_argument,
      requiredConnectors: question.required_connectors,
      expectedAnswerRubric: question.expected_answer_rubric,
      prior: isTurnTwo ? { turn_1_text: pending!.turn_1_text, ai_reply: pending!.ai_reply } : null,
      userText: user_text,
      isFinalTurn,
    })
  } catch (err) {
    // A genuine Gemini call failure (network/API) — runDebateTurn() itself
    // already resolves rather than throws for a malformed-but-received
    // response, so reaching this catch means the call never came back at all.
    console.error('Naale debate-answer grading error:', err)
    return NextResponse.json({ error: 'שגיאה בבדיקת התשובה, נסה שוב' }, { status: 502 })
  }

  if (!isFinalTurn) {
    // Turn 1 of a two-turn (levels 4-5) question: show the counter-argument,
    // no score/level/answer-row yet — those only happen once the exchange
    // reaches its final turn, below.
    await db.from('naale_sessions').update({
      pending_exchange: { question_id, turn_1_text: user_text, ai_reply: turnResult.ai_response },
    }).eq('id', session_id)
    return NextResponse.json({ awaiting_final: true, ai_response: turnResult.ai_response })
  }

  // Final turn — score, save, level, clear the pending exchange.
  // naale-debate-review-support: this question may have been re-served from
  // getSessionReviewQueue() (a wrong answer from a past session) rather than
  // fresh — same check open-answer/route.ts already makes. Recomputed here
  // rather than trusted from the client, same reasoning as everywhere else in
  // this app: what got served and what counts as a sanctioned review answer
  // must never disagree.
  const reviewQueue = await getSessionReviewQueue(session.student.id, session_id)
  const isSanctionedReview = reviewQueue.some(entry => entry.question_id === question_id)
  const countsAsReal = !isSanctionedReview && turnResult.gradingFailed !== true
  const { data: levelRow } = await db
    .from('naale_topic_levels')
    .select('level, correct_streak, wrong_streak, answered_count')
    .eq('student_id', session.student.id)
    .eq('topic', question.topic)
    .maybeSingle()

  const before = levelRow
    ? { level: levelRow.level, correct_streak: levelRow.correct_streak, wrong_streak: levelRow.wrong_streak }
    : { level: MIN_LEVEL, correct_streak: 0, wrong_streak: 0 }
  const after = countsAsReal ? applyGradedAnswer(before, turnResult.score!) : before

  const { error: answerError } = await db.from('naale_debate_answers').insert({
    session_id,
    student_id: session.student.id,
    question_id,
    topic: question.topic,
    difficulty: question.difficulty,
    level_at_answer: before.level,
    turn_1_text: isTurnTwo ? pending!.turn_1_text : user_text,
    turn_2_text: isTurnTwo ? user_text : null,
    ai_counter_argument: isTurnTwo ? pending!.ai_reply : null,
    score: turnResult.score,
    feedback: turnResult.feedback,
    is_review: !countsAsReal,
  })
  if (answerError) {
    if (answerError.code === '23505') {
      return NextResponse.json({ error: 'כבר ענית על שאלה זו', code: 'duplicate_answer' }, { status: 409 })
    }
    return NextResponse.json({ error: answerError.message }, { status: 500 })
  }

  await db.from('naale_sessions').update({
    pending_exchange: null,
    ...(countsAsReal ? { answered_count: owned.session.answered_count + 1 } : {}),
  }).eq('id', session_id)

  if (countsAsReal) {
    await db.from('naale_topic_levels').upsert({
      student_id: session.student.id,
      topic: question.topic,
      level: after.level,
      correct_streak: after.correct_streak,
      wrong_streak: after.wrong_streak,
      answered_count: (levelRow?.answered_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,topic' })
  }

  // Matches open-answer/route.ts's response shape (OpenAnswerResult on the
  // client) plus the transcript itself — no xp/coins field here either; the
  // client derives that via gradedAnswerReward(score), same convention as
  // every other AI-graded topic. The transcript fields (turn_1_text,
  // turn_2_text, ai_counter_argument) are debate-only additions on top of
  // that shared shape, so the already-answered view can show what was
  // actually argued instead of just the score — nothing else in this app's
  // AI-graded topics is a multi-turn exchange, so no other topic needs them.
  const milestone = countsAsReal ? await fetchRecentGradedAnswersMilestone(db, session.student.id) : null

  return NextResponse.json({
    awaiting_final: false,
    score: turnResult.score,
    feedback: turnResult.feedback,
    level: after.level,
    level_changed: after.level !== before.level,
    milestone,
    is_review: !countsAsReal,
    turn_1_text: isTurnTwo ? pending!.turn_1_text : user_text,
    turn_2_text: isTurnTwo ? user_text : null,
    ai_counter_argument: isTurnTwo ? pending!.ai_reply : null,
  })
}
