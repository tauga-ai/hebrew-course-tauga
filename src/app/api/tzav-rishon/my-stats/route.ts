import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'
import { getTotalQuestionCount } from '@/lib/tzav-rishon'
import { computeStats } from '@/lib/quiz-progress'

/** The authenticated student's own "דפ״ר לצו ראשון" performance summary, across all 4 topics. */
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data } = await db
    .from('tzav_rishon_results')
    .select('is_correct')
    .eq('student_id', session.student.id)

  return NextResponse.json(computeStats(data || [], getTotalQuestionCount()))
}
