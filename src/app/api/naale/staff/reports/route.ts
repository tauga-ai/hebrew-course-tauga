import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleStaff } from '@/lib/naale/auth'
import { selectAll } from '@/lib/naale/paginate'

/** One report as the staff page renders it. `note` and `prompt_snapshot` are
 *  what the reporter wrote and what the question said at the time — see the
 *  migration for why the prompt is snapshotted rather than joined. */
type ReportRow = {
  id: string
  created_at: string
  status: string
  question_kind: string
  question_row_id: string
  question_id: string
  topic: string
  difficulty: number
  prompt_snapshot: string
  student_answer: string | null
  student_was_correct: boolean | null
  note: string
  student_id: string
  resolved_at: string | null
}

/**
 * The staff-facing list of reported questions (N4, step 5).
 *
 * Staff-only, and deliberately unscoped beyond that: the same "all staff on
 * this track see all Naale students" decision that governs /staff/students
 * applies here, since a content mistake isn't a student's private data.
 *
 * Reporter names are resolved in a second query rather than an embedded join,
 * so this doesn't depend on a PostgREST relationship existing between
 * naale_question_reports and students — there is deliberately no FK from the
 * report to either question bank (see the migration), and keeping the reads
 * uniform makes that asymmetry less surprising.
 */
export async function GET() {
  const staff = await requireNaaleStaff()
  if (staff.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (staff.status === 'forbidden') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const db = createServiceClient()

  // Paginated: this table grows for the life of the track, and a silently
  // trimmed list would hide exactly the reports nobody has dealt with yet.
  const reports = await selectAll<ReportRow>('naale_question_reports', (from, to) =>
    db
      .from('naale_question_reports')
      .select(
        'id, created_at, status, question_kind, question_row_id, question_id, topic, difficulty, prompt_snapshot, student_answer, student_was_correct, note, student_id, resolved_at'
      )
      // Open first, then newest first — the triage order the index is built for.
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })
      .range(from, to)
  )

  const studentIds = [...new Set(reports.map(r => r.student_id))]
  const { data: students } = studentIds.length
    ? await db.from('students').select('id, full_name').in('id', studentIds)
    : { data: [] }
  const nameById = new Map((students ?? []).map(s => [s.id, s.full_name as string]))

  return NextResponse.json({
    reports: reports.map(({ student_id, ...report }) => ({
      ...report,
      student_name: nameById.get(student_id) ?? null,
    })),
  })
}

/**
 * Mark one report resolved (or reopen it). A triage list with no way to close
 * an item stops being a triage list within a week.
 */
export async function PATCH(req: NextRequest) {
  const staff = await requireNaaleStaff()
  if (staff.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (staff.status === 'forbidden') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let id: string, status: string
  try {
    ({ id, status } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }
  if (!id || (status !== 'open' && status !== 'resolved')) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('naale_question_reports')
    .update({
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      resolved_by: status === 'resolved' ? staff.student.id : null,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
