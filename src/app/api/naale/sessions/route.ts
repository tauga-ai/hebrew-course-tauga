import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { selectAll } from '@/lib/naale/paginate'

export interface NaaleSessionListItem {
  id: string
  kind: string
  started_at: string
  ended_at: string
  completed: boolean
  answered_count: number
}

/**
 * The authenticated student's own past sessions, newest first — the list half
 * of the session-history browser on /naale/stats.
 *
 * Scoped to session.student.id with no student_id parameter, the same rule as
 * my-stats: students see themselves and nobody else. Staff read other
 * students through /api/naale/staff/students instead.
 *
 * Only ended sessions are listed. An abandoned session is never closed out
 * server-side — beforeunload only warns, nothing posts to /session/end — so
 * a student who walks away leaves a row with ended_at null that would
 * otherwise appear here with no end time and a breakdown of whatever they
 * happened to answer before leaving. They're excluded rather than shown as
 * blanks; the exception is the session/start sweep, which closes out an
 * expired one the next time the student begins anything, at which point it
 * appears here normally.
 */
export async function GET() {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()

  // Paginated for the same reason my-stats paginates its answers: one student
  // accumulates sessions for a whole school year, and Supabase caps an
  // unbounded select at 1000 rows silently.
  const sessions = await selectAll<NaaleSessionListItem>('naale_sessions', (from, to) =>
    db
      .from('naale_sessions')
      .select('id, kind, started_at, ended_at, completed, answered_count')
      .eq('student_id', session.student.id)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .range(from, to)
  )

  return NextResponse.json({ sessions })
}
