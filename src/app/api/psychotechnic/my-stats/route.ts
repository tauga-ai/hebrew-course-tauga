import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getStudentFromSession } from '@/lib/auth'

/**
 * The authenticated student's own psychotechnic performance summary —
 * distinct sets attempted and average score. No student-facing route
 * existed for this before; only teachers could see it via api/teacher/*.
 */
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data: submissions } = await db
    .from('psychotechnic_submissions')
    .select('set_id, score, total')
    .eq('student_id', session.student.id)

  const rows = submissions || []
  const attempted_sets = new Set(rows.map(r => r.set_id)).size
  const avg_pct = rows.length > 0
    ? rows.reduce((sum, r) => sum + (r.score / r.total) * 100, 0) / rows.length
    : null

  return NextResponse.json({ attempted_sets, avg_pct })
}
