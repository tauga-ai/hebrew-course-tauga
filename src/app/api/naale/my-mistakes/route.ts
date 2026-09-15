import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { selectAll } from '@/lib/naale/paginate'
import { collapseToMistakes, isOpenAnswerWrong, MAX_MISTAKES, type MistakeAttempt } from '@/lib/naale/mistakes'
import { publicOpenFields } from '@/lib/naale/open-exercise-display'

/**
 * The questions the calling student is still getting wrong, from all answer
 * banks, for the mistakes review screen.
 *
 * Three rules, all applied here rather than in the query, because each of them
 * needs to see answers the naive query would have filtered out:
 *
 *  1. ALL banks. This route used to read only naale_answers, so the three
 *     AI-graded topics could never appear on a screen titled "mistakes by
 *     topic" — 19 of a cohort's 23 recorded mistakes were invisible.
 *     naale-debate-review-support later added naale_debate_answers as a
 *     third source, same reasoning.
 *
 *  2. Practice only. Placement writes into the same tables, and it
 *     deliberately asks above a student's level to find their starting point
 *     (which is also why it's excluded from "completed sessions" everywhere
 *     else). Showing those back as the student's mistakes would greet every
 *     student with a list of failures on day one.
 *
 *  3. Latest attempt decides — see collapseToMistakes(). This is why the reads
 *     below fetch EVERY attempt rather than just the wrong ones: a correction
 *     is a separate row, so filtering on is_correct=false in SQL would make
 *     the fix invisible and the mistake permanent.
 *
 * Scoped to the calling student's own data only — never another student's.
 */
export async function GET() {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const studentId = session.student.id

  // Practice AND topic session ids, so placement is excluded by set
  // membership. The exclusion this set exists for is placement's above-level
  // calibration questions (see the doc comment above) — a wrong answer during
  // a 5-minute topic session is a real mistake the same way a 30-minute one
  // is, so topic sessions belong on this screen too
  // (naale-topic-based-sessions). Doing it this way also covers rows written
  // before this change, which a column filter could not.
  const sessions = await selectAll<{ id: string; kind: string }>('naale_sessions', (from, to) =>
    db.from('naale_sessions').select('id, kind').eq('student_id', studentId).range(from, to))
  const practiceIds = new Set(sessions.filter(s => s.kind === 'practice' || s.kind === 'topic').map(s => s.id))

  const [mcq, open, debate] = await Promise.all([
    selectAll<{
      question_id: string; session_id: string; topic: string
      is_correct: boolean; chosen_answer: string | null; is_review: boolean; answered_at: string
    }>('naale_answers', (from, to) =>
      db.from('naale_answers')
        .select('question_id, session_id, topic, is_correct, chosen_answer, is_review, answered_at')
        .eq('student_id', studentId)
        .range(from, to)),
    selectAll<{
      question_id: string; session_id: string; topic: string
      score: number; user_text: string; feedback: string; is_review: boolean; answered_at: string
    }>('naale_open_answers', (from, to) =>
      db.from('naale_open_answers')
        .select('question_id, session_id, topic, score, user_text, feedback, is_review, answered_at')
        .eq('student_id', studentId)
        .range(from, to)),
    // naale-debate-review-support: same gap this file's own doc comment
    // already describes for the other two AI-graded topics, now fixed for
    // debate too — a two-turn transcript instead of one user_text.
    selectAll<{
      question_id: string; session_id: string; topic: string
      score: number; turn_1_text: string; turn_2_text: string | null; ai_counter_argument: string | null
      feedback: string; is_review: boolean; answered_at: string
    }>('naale_debate_answers', (from, to) =>
      db.from('naale_debate_answers')
        .select('question_id, session_id, topic, score, turn_1_text, turn_2_text, ai_counter_argument, feedback, is_review, answered_at')
        .eq('student_id', studentId)
        .range(from, to)),
  ])

  const attempts: MistakeAttempt[] = [
    ...mcq
      // A pre-migration row (chosen_answer null) has no answer to show, but its
      // correctness is recorded — so a correct one may still clear a mistake,
      // while a wrong one is dropped rather than rendered as a blank entry.
      .filter(a => practiceIds.has(a.session_id) && (a.is_correct || a.chosen_answer !== null))
      .map(a => ({
        question_id: a.question_id,
        session_id: a.session_id,
        topic: a.topic,
        answered_at: a.answered_at,
        kind: 'mcq' as const,
        was_correct: a.is_correct,
        answer_text: a.chosen_answer ?? '',
        is_review: a.is_review,
      })),
    ...open
      .filter(a => practiceIds.has(a.session_id))
      .map(a => ({
        question_id: a.question_id,
        session_id: a.session_id,
        topic: a.topic,
        answered_at: a.answered_at,
        kind: 'open' as const,
        was_correct: !isOpenAnswerWrong(a.score),
        answer_text: a.user_text,
        feedback: a.feedback,
        is_review: a.is_review,
      })),
    ...debate
      .filter(a => practiceIds.has(a.session_id))
      .map(a => ({
        question_id: a.question_id,
        session_id: a.session_id,
        topic: a.topic,
        answered_at: a.answered_at,
        kind: 'conversation' as const,
        was_correct: !isOpenAnswerWrong(a.score),
        answer_text: [a.turn_1_text, a.turn_2_text].filter(Boolean).join('\n'),
        feedback: a.feedback,
        ai_counter_argument: a.ai_counter_argument,
        is_review: a.is_review,
      })),
  ]

  const all = collapseToMistakes(attempts)
  const page = all.slice(0, MAX_MISTAKES)

  if (!page.length) return NextResponse.json({ mistakes: [], total: 0 })

  const mcqIds = [...new Set(page.filter(m => m.kind === 'mcq').map(m => m.question_id))]
  const openIds = [...new Set(page.filter(m => m.kind === 'open').map(m => m.question_id))]
  const debateIds = [...new Set(page.filter(m => m.kind === 'conversation').map(m => m.question_id))]

  const [mcqBank, openBank, debateBank] = await Promise.all([
    mcqIds.length
      ? db.from('naale_questions').select('id, prompt, correct_answer').in('id', mcqIds)
      : Promise.resolve({ data: [] as { id: string; prompt: string; correct_answer: string }[] }),
    openIds.length
      ? db.from('naale_open_questions').select('id, prompt, fields').in('id', openIds)
      : Promise.resolve({ data: [] as { id: string; prompt: string; fields: Record<string, string> }[] }),
    // naale_debate_questions has no uuid `id` — question_id (text) IS its
    // primary key, unlike the other two tables, so this looks up by that
    // column instead of `id`.
    debateIds.length
      ? db.from('naale_debate_questions').select('question_id, initial_ai_argument').in('question_id', debateIds)
      : Promise.resolve({ data: [] as { question_id: string; initial_ai_argument: string }[] }),
  ])

  const mcqById = new Map((mcqBank.data ?? []).map(q => [q.id, q]))
  const openById = new Map((openBank.data ?? []).map(q => [q.id, q]))
  const debateById = new Map((debateBank.data ?? []).map(q => [q.question_id, q]))

  const mistakes = page
    // A question pulled from the bank since it was answered has nothing to show.
    .filter(m => (m.kind === 'mcq' ? mcqById.has(m.question_id) : m.kind === 'open' ? openById.has(m.question_id) : debateById.has(m.question_id)))
    .map(m => {
      const base = {
        id: `${m.kind}:${m.question_id}`,
        kind: m.kind,
        topic: m.topic,
        session_id: m.session_id,
        answered_at: m.answered_at,
        attempt_count: m.attempt_count,
        chosen_answer: m.answer_text,
      }

      if (m.kind === 'mcq') {
        const q = mcqById.get(m.question_id)!
        return { ...base, prompt: q.prompt, correct_answer: q.correct_answer }
      }

      if (m.kind === 'conversation') {
        const q = debateById.get(m.question_id)!
        // No grading-only field to strip here the way publicOpenFields() does
        // for 'open' — initial_ai_argument is already shown to every student
        // who ever sees this question, unlike an open topic's model answer.
        return { ...base, prompt: q.initial_ai_argument, feedback: m.feedback, ai_counter_argument: m.ai_counter_argument }
      }

      const q = openById.get(m.question_id)!
      // publicOpenFields() drops expected_phrasing/expected_summary — the model
      // answer for this exact row. These questions can be re-served by the
      // session-opening review, so shipping them would give away the answer to
      // a question the student is about to see again.
      return { ...base, prompt: q.prompt, fields: publicOpenFields(m.topic, q.fields ?? {}), feedback: m.feedback }
    })

  return NextResponse.json({ mistakes, total: all.length })
}
