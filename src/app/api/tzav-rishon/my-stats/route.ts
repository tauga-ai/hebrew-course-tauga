import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'
import { getTotalQuestionCount } from '@/lib/tzav-rishon'

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

  const rows = data || []
  const attempted = rows.length
  const avg_pct = attempted > 0
    ? (rows.filter(r => r.is_correct).length / attempted) * 100
    : null

  return NextResponse.json({ attempted, total: getTotalQuestionCount(), avg_pct })
}
