import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleStaff } from '@/lib/naale/auth'
import { buildStudentProgress } from '@/lib/naale/stats'
import { loadAllTopics } from '@/lib/naale/topics'
import { selectAll } from '@/lib/naale/paginate'

/**
 * All Naale students with their per-topic levels and counts, for staff.
 *
 * Two scoping rules, both server-side:
 *  1. Staff role required — a Naale student calling this would see every
 *     classmate's progress, which the spec explicitly forbids.
 *  2. Naale class only, AND naale_role = 'student' only. Staff must never see
 *     the Druze/Arabic or adult-Russian populations, even though all three
 *     share the students table — and staff must not see themselves/each
 *     other listed as students (they have students rows too, so they can
 *     practice).
 *
 * naale_role is denormalized onto students at provisioning time (see
 * getNaaleSession()) specifically so this filter is a plain column check,
 * not a per-request Admin API email lookup.
 *
 * There is deliberately NO per-counselor/group filtering: the spec resolved
 * that all staff on this track see all Naale students. That differs from the
 * existing teacher dashboard (resolveClassAndGroup() scopes by class AND
 * lesson group) — the omission here is intentional, not an oversight.
 *
 * This route used to read only naale_questions/naale_answers and derive its
 * own totals, so all three AI-graded topics were absent from every response —
 * level, exercise count and accuracy together — while the student's own screen
 * showed them (audit H1). Number-crunching is now the same shared function
 * /api/naale/my-stats uses, so the two views can't disagree.
 *
 * Returns one row per student: identity, avatar and totals. Per-topic levels
 * and session dates are served by
 * /api/naale/staff/students/[studentId] instead — this is the cohort-wide
 * read, so anything added here is paid for once per student.
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

  const { data: naaleClass } = await db
    .from('classes')
    .select('id')
    .eq('track', 'naale')
    .maybeSingle()

  if (!naaleClass) return NextResponse.json({ error: 'naale class missing' }, { status: 500 })

  const { data: students } = await db
    .from('students')
    .select('id, full_name, created_at, auth_user_id')
    .eq('class_id', naaleClass.id)
    .eq('naale_role', 'student')

  const allTopics = await loadAllTopics(db)

  const studentIds = (students ?? []).map(s => s.id)
  // Cohort-wide, so these are the first reads to cross max_rows in real use:
  // ~30 students answering ~25 questions a session passes 1000 answers within
  // weeks, and a truncated read would put staff's numbers quietly back out of
  // step with the students' own — the very bug this route just had.
  const [levels, answers, openAnswers, sessions] = await Promise.all([
    selectAll<{ student_id: string; topic: string; level: number }>('naale_topic_levels', (from, to) =>
      db.from('naale_topic_levels').select('student_id, topic, level').in('student_id', studentIds).range(from, to)),
    selectAll<{ student_id: string; topic: string; is_correct: boolean; is_review: boolean; session_id: string }>('naale_answers', (from, to) =>
      db.from('naale_answers').select('student_id, topic, is_correct, is_review, session_id').in('student_id', studentIds).range(from, to)),
    selectAll<{ student_id: string; topic: string; score: number; is_review: boolean; session_id: string }>('naale_open_answers', (from, to) =>
      db.from('naale_open_answers').select('student_id, topic, score, is_review, session_id').in('student_id', studentIds).range(from, to)),
    selectAll<{ id: string; student_id: string; kind: string; completed: boolean; started_at: string }>('naale_sessions', (from, to) =>
      db.from('naale_sessions').select('id, student_id, kind, completed, started_at').in('student_id', studentIds).range(from, to)),
  ])

  // Google's profile photo per student, same display-only relay as
  // /api/naale/me — never stored, a missing/failed one just falls back to
  // an initials badge client-side. One admin lookup per student is fine at
  // this cohort's scale (dozens, not thousands).
  const avatarByAuthId = new Map(
    await Promise.all(
      (students ?? []).map(async s => {
        const { data } = await db.auth.admin.getUserById(s.auth_user_id)
        const meta = data?.user?.user_metadata
        const avatarUrl = (meta?.avatar_url as string | undefined) ?? (meta?.picture as string | undefined) ?? null
        return [s.auth_user_id, avatarUrl] as const
      })
    )
  )

  // `totals` only — `topics` and `session_dates` moved to
  // /api/naale/staff/students/[studentId] when detail became its own route.
  // They were here so a dialog could open with no second fetch, which meant
  // every addition to the detail view inflated the payload for the whole
  // cohort. The per-student number crunching stays: the roster's accuracy bar
  // and "needs attention" section are derived from it.
  const rows = (students ?? []).map(s => {
    const progress = buildStudentProgress({
      allTopics,
      levels: levels.filter(l => l.student_id === s.id),
      answers: answers.filter(a => a.student_id === s.id),
      openAnswers: openAnswers.filter(a => a.student_id === s.id),
      sessions: sessions.filter(x => x.student_id === s.id),
    })

    return {
      student_id: s.id,
      full_name: s.full_name,
      avatar_url: avatarByAuthId.get(s.auth_user_id) ?? null,
      totals: progress.totals,
    }
  })

  return NextResponse.json({ students: rows })
}
