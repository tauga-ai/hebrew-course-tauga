import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { debugMode } from '@/lib/dev-i18n'

/**
 * Debug-only: resets the CALLER'S OWN progress back to brand-new — same
 * deletes as scripts/reset-naale-student.ts, minus the email lookup.
 * Deliberately narrower than that script: this can only ever target the
 * authenticated caller, never an arbitrary email, since it's reachable from
 * inside the running app rather than a terminal a developer already
 * controls.
 *
 * Deletes naale_answers explicitly rather than relying on the FK cascade
 * from naale_sessions, so the response can report accurate counts of what
 * was actually removed.
 */
export async function POST() {
  if (!debugMode) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const studentId = session.student.id

  const answers = await db.from('naale_answers').delete().eq('student_id', studentId).select('id')
  const sessions = await db.from('naale_sessions').delete().eq('student_id', studentId).select('id')
  const levels = await db.from('naale_topic_levels').delete().eq('student_id', studentId).select('id')

  return NextResponse.json({
    deleted: {
      naale_answers: answers.data?.length ?? 0,
      naale_sessions: sessions.data?.length ?? 0,
      naale_topic_levels: levels.data?.length ?? 0,
    },
  })
}
