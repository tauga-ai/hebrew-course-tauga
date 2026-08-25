import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { selectAll } from '@/lib/naale/paginate'

/**
 * Wrong answers from the calling student's past sessions, for the mistakes
 * review screen. Only returns answers where chosen_answer is non-null (i.e.
 * recorded after the naale_answers_chosen_answer migration) — pre-migration
 * rows are silently excluded rather than surfaced as blank entries.
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

  const mistakes = await selectAll<{
    id: string
    question_id: string
    session_id: string
    topic: string
    chosen_answer: string
    answered_at: string
  }>('naale_answers', (from, to) =>
    db.from('naale_answers')
      .select('id, question_id, session_id, topic, chosen_answer, answered_at')
      .eq('student_id', studentId)
      .eq('is_correct', false)
      .not('chosen_answer', 'is', null)
      .order('answered_at', { ascending: false })
      .range(from, to)
  )

  if (!mistakes.length) return NextResponse.json({ mistakes: [] })

  // Fetch the question prompts and correct answers in one query
  const questionIds = [...new Set(mistakes.map(m => m.question_id))]
  const { data: questions } = await db
    .from('naale_questions')
    .select('id, prompt, correct_answer')
    .in('id', questionIds)

  const questionMap = new Map((questions ?? []).map(q => [q.id, q]))

  const result = mistakes
    .filter(m => questionMap.has(m.question_id))
    .map(m => {
      const q = questionMap.get(m.question_id)!
      return {
        id: m.id,
        session_id: m.session_id,
        topic: m.topic,
        prompt: q.prompt,
        chosen_answer: m.chosen_answer,
        correct_answer: q.correct_answer,
        answered_at: m.answered_at,
      }
    })

  return NextResponse.json({ mistakes: result })
}
