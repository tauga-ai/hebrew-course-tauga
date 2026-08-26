import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleStaff } from '@/lib/naale/auth'
import { buildStudentProgress } from '@/lib/naale/stats'
import { loadAllTopics } from '@/lib/naale/topics'
import { selectAll } from '@/lib/naale/paginate'

/**
 * One Naale student's full progress, for staff — the depth behind a roster row.
 *
 * Split out of /api/naale/staff/students when per-student detail moved from a
 * dialog to its own route. The list endpoint used to ship every student's
 * topics and session dates so the dialog could render without a second fetch,
 * which meant anything added to the detail view inflated the payload for the
 * whole cohort. Now the list carries what the table draws and this carries the
 * rest.
 *
 * Two gates, both server-side, mirroring the list route:
 *  1. Staff role required — requireNaaleStaff().
 *  2. The *target* must be a Naale student. Without the class + naale_role
 *     check, a staff member could reach a Druze/Arabic or adult-Russian
 *     student, or another staff member, by putting their id in the URL —
 *     staff have students rows too, so they can practice.
 *
 * Reads go through selectAll(). Filtering by student_id is not a bound:
 * tests/naale-pagination-guard.test.mjs only counts .eq('session_id') as
 * narrowing on the answer tables, and one student across a whole program can
 * pass max_rows on their own.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const staff = await requireNaaleStaff()
  if (staff.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (staff.status === 'forbidden') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Next 16: params is a Promise everywhere, including route handlers.
  const { studentId } = await params

  const db = createServiceClient()

  const { data: naaleClass } = await db
    .from('classes')
    .select('id')
    .eq('track', 'naale')
    .maybeSingle()

  if (!naaleClass) return NextResponse.json({ error: 'naale class missing' }, { status: 500 })

  const { data: student } = await db
    .from('students')
    .select('id, full_name, auth_user_id')
    .eq('id', studentId)
    .eq('class_id', naaleClass.id)
    .eq('naale_role', 'student')
    .maybeSingle()

  // Same 404 for "no such id" and "not a Naale student", so the response can't
  // be used to probe which ids exist on other tracks.
  if (!student) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const allTopics = await loadAllTopics(db)

  const [levels, answers, openAnswers, sessions] = await Promise.all([
    selectAll<{ topic: string; level: number }>('naale_topic_levels', (from, to) =>
      db.from('naale_topic_levels').select('topic, level').eq('student_id', student.id).range(from, to)),
    selectAll<{ topic: string; is_correct: boolean; is_review: boolean; session_id: string }>('naale_answers', (from, to) =>
      db.from('naale_answers').select('topic, is_correct, is_review, session_id').eq('student_id', student.id).range(from, to)),
    selectAll<{ topic: string; score: number; is_review: boolean; session_id: string }>('naale_open_answers', (from, to) =>
      db.from('naale_open_answers').select('topic, score, is_review, session_id').eq('student_id', student.id).range(from, to)),
    selectAll<{ id: string; kind: string; completed: boolean; started_at: string }>('naale_sessions', (from, to) =>
      db.from('naale_sessions').select('id, kind, completed, started_at').eq('student_id', student.id).range(from, to)),
  ])

  const progress = buildStudentProgress({ allTopics, levels, answers, openAnswers, sessions })

  // Display-only relay of Google's profile photo, same as /api/naale/me and the
  // list route — never stored, falls back to an initials badge client-side.
  const { data: authUser } = await db.auth.admin.getUserById(student.auth_user_id)
  const meta = authUser?.user?.user_metadata
  const avatarUrl = (meta?.avatar_url as string | undefined) ?? (meta?.picture as string | undefined) ?? null

  const sessionDates = sessions
    .filter(x => x.completed && x.kind === 'practice')
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .map(x => ({ id: x.id, started_at: x.started_at }))

  return NextResponse.json({
    student: {
      student_id: student.id,
      full_name: student.full_name,
      avatar_url: avatarUrl,
      topics: progress.topics,
      totals: progress.totals,
      session_dates: sessionDates,
    },
  })
}
