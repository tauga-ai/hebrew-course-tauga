import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'

/** The authenticated student's own sentence-building performance summary. */
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data: results } = await db
    .from('sentence_results')
    .select('score')
    .eq('student_id', session.student.id)

  const rows = results || []
  const attempted = rows.length
  const avg_score = attempted > 0
    ? rows.reduce((sum, r) => sum + r.score, 0) / attempted
    : null

  return NextResponse.json({ attempted, avg_score })
}
