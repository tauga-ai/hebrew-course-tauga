import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { debugMode } from '@/lib/dev-i18n'
import { MIN_LEVEL } from '@/lib/naale/leveling'

/**
 * Debug-only: makes the NEXT practice session actually open with a review
 * question, for testing ticket 15's session-opener without needing a real
 * wrong answer from a genuine prior session.
 *
 * There is no stored "review pending" flag anywhere (see review-queue.ts) —
 * whether a review question gets served is recomputed live on every call,
 * from the most recent ENDED practice session's non-review answers,
 * preferring wrong ones. So the only way to force this is to leave behind a
 * real ended practice session containing a real wrong, non-review answer —
 * this route does exactly that, seeding one synthetic naale_answers row.
 * That row is indistinguishable from a real historical answer if anyone
 * inspects the raw data later; the Dev Panel copy calling this must say so
 * plainly.
 *
 * Seeds a graded (naale_open_answers) row too, since the opener now draws from
 * both banks (#5 / H2) — an MCQ-only seed would exercise only the half that
 * already worked. Both land in the same previous session, and both count as
 * wrong, so the next session's queue should open with one of each kind. The
 * graded row IS identifiable as synthetic, unlike the MCQ one: a graded answer
 * carries free text, so it is stamped rather than left to look real.
 */
export async function POST() {
  if (!debugMode) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const studentId = session.student.id

  // Prefer a topic the student already has a level for for (so difficulty
  // and level_at_answer line up with something real); fall back to
  // whichever topic the question bank has first, at MIN_LEVEL.
  const { data: levels } = await db
    .from('naale_topic_levels')
    .select('topic, level')
    .eq('student_id', studentId)
    .limit(1)

  let topic = levels?.[0]?.topic
  let level = levels?.[0]?.level ?? MIN_LEVEL

  if (!topic) {
    const { data: anyQuestion } = await db.from('naale_questions').select('topic').limit(1).maybeSingle()
    topic = anyQuestion?.topic
    level = MIN_LEVEL
  }

  if (!topic) {
    return NextResponse.json({ error: 'no topics in the question bank at all' }, { status: 400 })
  }

  const { data: question } = await db
    .from('naale_questions')
    .select('id, difficulty')
    .eq('topic', topic)
    .limit(1)
    .maybeSingle()

  if (!question) {
    return NextResponse.json({ error: `no questions for topic "${topic}"` }, { status: 400 })
  }

  // Reuse the most recent ended practice session if one exists — a review
  // queue is scoped to ONE specific "previous session", so an extra ended
  // session lying around costs nothing and keeps this from proliferating
  // fake sessions on repeated use.
  const { data: endedPractice } = await db
    .from('naale_sessions')
    .select('id')
    .eq('student_id', studentId)
    .eq('kind', 'practice')
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let sessionId = endedPractice?.id

  if (!sessionId) {
    const now = new Date().toISOString()
    const { data: created, error } = await db
      .from('naale_sessions')
      .insert({ student_id: studentId, kind: 'practice', started_at: now, deadline_at: now, ended_at: now, completed: true })
      .select('id')
      .single()

    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? 'failed to create a seed session' }, { status: 500 })
    }
    sessionId = created.id
  }

  const { error: insertError } = await db.from('naale_answers').insert({
    session_id: sessionId,
    student_id: studentId,
    question_id: question.id,
    topic,
    difficulty: question.difficulty,
    level_at_answer: level,
    is_correct: false,
    is_review: false,
  })

  // 23505 means this exact row was already seeded — the session and the
  // question are both picked deterministically, so a second click lands on the
  // same pair. Already-seeded is the desired end state, not an error.
  if (insertError && insertError.code !== '23505') {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // The graded half. Absent from the bank on a project that hasn't imported
  // the open-response sheets yet, in which case this degrades to the old
  // MCQ-only seed rather than failing.
  const { data: openQuestion } = await db
    .from('naale_open_questions')
    .select('id, topic, difficulty')
    .limit(1)
    .maybeSingle()

  if (openQuestion) {
    const { error: openError } = await db.from('naale_open_answers').insert({
      session_id: sessionId,
      student_id: studentId,
      question_id: openQuestion.id,
      topic: openQuestion.topic,
      difficulty: openQuestion.difficulty,
      level_at_answer: MIN_LEVEL,
      user_text: '[dev seed-review]',
      // 1, not 3: the queue's threshold for review-worthy is now
      // GRADED_CORRECT_SCORE (see review.ts's toReviewCandidates), and a seed
      // should sit clearly on one side of it rather than on the boundary the
      // L3 fix just moved.
      score: 1,
      feedback: '[dev seed-review]',
      is_review: false,
    })
    if (openError && openError.code !== '23505') {
      return NextResponse.json({ error: openError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    topic,
    question_id: question.id,
    open_topic: openQuestion?.topic ?? null,
    open_question_id: openQuestion?.id ?? null,
    seeded_into_session: sessionId,
  })
}
