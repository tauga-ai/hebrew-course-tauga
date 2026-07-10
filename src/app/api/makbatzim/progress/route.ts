import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'
import { getQuestionById, isSetComplete } from '@/lib/makbatzim'
import { enrichProgress } from '@/lib/quiz-progress'

/**
 * The authenticated student's own already-answered questions for one set —
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

  const setId = req.nextUrl.searchParams.get('set_id')
  if (!setId) return NextResponse.json({ error: 'missing set_id' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('makbatzim_results')
    .select('question_id, selected_option, is_correct')
    .eq('student_id', session.student.id)
    .eq('set_id', setId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // dapar-simulation withholds correctness for previously-answered
  // questions too, not just the live submit response — otherwise resuming
  // or navigating back mid-set would leak it via this route instead.
  const reveal = setId !== 'dapar-simulation' || (await isSetComplete(db, session.student.id, setId))
  const progress = enrichProgress(data || [], id => getQuestionById(setId, id), reveal)

  return NextResponse.json({ progress })
}
