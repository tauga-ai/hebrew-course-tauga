import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getStudentFromSession } from '@/lib/auth'

/** The authenticated student's own simulation performance summary. */
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data: sessions } = await db
    .from('simulation_sessions')
    .select('status, part_a_correct, part_b_correct, part_c_avg_score, part_d_score, part_d_level, completed_at')
    .eq('student_id', session.student.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  const rows = sessions || []
  const completed_count = rows.length
  const latest = rows[0]
    ? {
        part_a_correct: rows[0].part_a_correct,
        part_b_correct: rows[0].part_b_correct,
        part_c_avg_score: rows[0].part_c_avg_score,
        part_d_score: rows[0].part_d_score,
        part_d_level: rows[0].part_d_level,
        completed_at: rows[0].completed_at,
      }
    : null

  return NextResponse.json({ completed_count, latest })
}
