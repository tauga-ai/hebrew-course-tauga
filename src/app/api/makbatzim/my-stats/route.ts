import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'
import { SETS } from '@/lib/makbatzim'
import { computeStats } from '@/lib/quiz-progress'

const DAPAR_SET_ID = 'dapar-simulation'

/**
 * The authenticated student's own "מקבצים פסיכוטכני" performance summary.
 * dapar-simulation is reported as its own line (`dapar`), separate from the
 * regular sets (`regular`) — it's a single 40-question exam with
 * deferred/end-of-set feedback, not an incremental practice set, so folding
 * it into the same total would misrepresent both numbers.
 */
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data } = await db
    .from('makbatzim_results')
    .select('set_id, is_correct')
    .eq('student_id', session.student.id)

  const rows = data || []
  const daparTotal = SETS.find(s => s.key === DAPAR_SET_ID)?.count ?? 0
  const regularTotal = SETS.filter(s => s.key !== DAPAR_SET_ID).reduce((sum, s) => sum + s.count, 0)

  return NextResponse.json({
    regular: computeStats(rows.filter(r => r.set_id !== DAPAR_SET_ID), regularTotal),
    dapar: computeStats(rows.filter(r => r.set_id === DAPAR_SET_ID), daparTotal),
  })
}
