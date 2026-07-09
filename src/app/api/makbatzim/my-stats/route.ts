import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'
import { getTotalQuestionCount } from '@/lib/makbatzim'
import { computeStats } from '@/lib/quiz-progress'

/** The authenticated student's own "שאלות שעדי שלחה" performance summary, across all 6 sets. */
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data } = await db
    .from('makbatzim_results')
    .select('is_correct')
    .eq('student_id', session.student.id)

  return NextResponse.json(computeStats(data || [], getTotalQuestionCount()))
}
