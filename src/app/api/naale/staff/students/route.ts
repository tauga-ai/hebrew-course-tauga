import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleStaff } from '@/lib/naale/auth'

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
 * showed them (audit H1). That bug is what buildStudentProgress()
 * (src/lib/naale/stats.ts) originally fixed, and /api/naale/my-stats still
 * uses it — but this route no longer does (see naale-aggregate-query-performance):
 * downloading every answer/open-answer/session for the whole class to compute
 * ~30 numbers doesn't scale past a few weeks of real usage, so the same math
 * is now done inside the database by naale_staff_student_totals(), verified
 * once against this route's old output before the old path was removed.
 *
 * Returns one row per student: identity, avatar and totals. Per-topic levels
 * and session dates are served by
 * /api/naale/staff/students/[studentId] instead — this is the cohort-wide
 * read, so anything added here is paid for once per student.
 */
interface StudentTotals {
  student_id: string
  answered: number
  correct: number
  sessions: number
  completed_sessions: number
  xp: number
  coins: number
}
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

  const studentIds = (students ?? []).map(s => s.id)

  // One aggregated row per student, computed inside the database instead of
  // downloading every answer/open-answer/session for the whole class —
  // see naale_staff_student_totals()'s own comment for what it replaces.
  const { data: totalsRows, error: totalsError } = await db.rpc('naale_staff_student_totals', {
    p_student_ids: studentIds,
  })
  if (totalsError) return NextResponse.json({ error: totalsError.message }, { status: 500 })
  const totalsByStudent = new Map((totalsRows as StudentTotals[]).map(t => [t.student_id, t]))

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
  // cohort. The roster's accuracy bar and "needs attention" section are
  // still derived from `totals` — just looked up per student now instead of
  // computed per student.
  const rows = (students ?? []).map(s => {
    const totals = totalsByStudent.get(s.id) ?? {
      answered: 0, correct: 0, sessions: 0, completed_sessions: 0, xp: 0, coins: 0,
    }

    return {
      student_id: s.id,
      full_name: s.full_name,
      avatar_url: avatarByAuthId.get(s.auth_user_id) ?? null,
      totals,
    }
  })

  return NextResponse.json({ students: rows })
}
