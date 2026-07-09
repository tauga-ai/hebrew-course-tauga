import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'

/** The authenticated student's own interview-practice performance summary. */
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data: results } = await db
    .from('interview_results')
    .select('score, level, submitted_at')
    .eq('student_id', session.student.id)
    .order('submitted_at', { ascending: false })

  const rows = results || []
  const count = rows.length
  const avg_score = count > 0
    ? rows.reduce((sum, r) => sum + r.score, 0) / count
    : null
  const latest_level = rows[0]?.level ?? null

  return NextResponse.json({ count, avg_score, latest_level })
}
