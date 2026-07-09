import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'
import { getQuestionById } from '@/lib/tzav-rishon'

/**
 * The authenticated student's own already-answered questions for one topic —
 * used to resume and to re-show feedback for a question they navigate back
 * to. Enriched with `correct_option`/`explanation` (looked up server-side,
 * not stored per-row) so a resumed/revisited question can show the same
 * feedback as a live answer without a second round-trip — the public
 * /questions route deliberately withholds both of these until a question is
 * actually answered.
 */
export async function GET(req: NextRequest) {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const topic = req.nextUrl.searchParams.get('topic')
  if (!topic) return NextResponse.json({ error: 'missing topic' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('tzav_rishon_results')
    .select('question_id, selected_option, is_correct')
    .eq('student_id', session.student.id)
    .eq('topic', topic)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const progress = (data || []).map(row => {
    const question = getQuestionById(topic, row.question_id)
    return {
      ...row,
      correct_option: question?.correctOption ?? null,
      explanation: question?.explanation ?? null,
    }
  })

  return NextResponse.json({ progress })
}
