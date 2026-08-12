import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { NaaleRole, Student } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

export type NaaleSessionResult =
  | { status: 'unauthenticated' }
  /** Authenticated with Google, but the email is not on the school's roster.
   *  There is no manual path picker on this track, so this is a dead end by
   *  design — the UI must show a "contact your counselor" page. Never a crash,
   *  and never a silently-defaulted role. */
  | { status: 'not_on_roster'; user: User }
  | { status: 'ok'; user: User; role: NaaleRole; student: Student }

const NAALE_TRACK = 'naale'
const STUDENT_COLUMNS = 'id, full_name, class_id, created_at, lesson_group, naale_role'

/**
 * Resolves a Naale-track caller from the Supabase session.
 *
 * Three things this does that getStudentFromSession() does not:
 *  1. Derives the role from naale_roster by email — the school's CSV is the
 *     only source of truth for who gets in and as what.
 *  2. Auto-provisions the students row on first login. This track has no
 *     /student/complete-profile step: the roster already vouches for the
 *     student, and the display name comes from their Google identity.
 *  3. Verifies the student's class is on the 'naale' track, so a draft-prep
 *     student's valid cookie cannot reach Naale data.
 *
 * Never call getStudentFromSession() from a Naale route — it does not check
 * track, and would let the other two populations through.
 */
export async function getNaaleSession(): Promise<NaaleSessionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { status: 'unauthenticated' }

  const db = createServiceClient()

  // Roster check FIRST — an off-roster email must never reach the insert below.
  const { data: rosterRow } = await db
    .from('naale_roster')
    .select('email, role')
    .eq('email', user.email)
    .maybeSingle()

  if (!rosterRow) return { status: 'not_on_roster', user }
  const role = rosterRow.role as NaaleRole

  const { data: naaleClass } = await db
    .from('classes')
    .select('id')
    .eq('track', NAALE_TRACK)
    .maybeSingle()

  if (!naaleClass) throw new Error('naale class row missing — run migration_naale_track.sql')

  const { data: existing } = await db
    .from('students')
    .select(STUDENT_COLUMNS)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (existing) {
    // A roster email whose students row points at another track's class means
    // the same person exists on two tracks. Refuse rather than silently
    // reading/writing across the isolation boundary.
    if (existing.class_id !== naaleClass.id) return { status: 'not_on_roster', user }
    return { status: 'ok', user, role, student: existing as Student }
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined)?.trim() || user.email

  const { data: created, error } = await db
    .from('students')
    .insert({ full_name: fullName, class_id: naaleClass.id, auth_user_id: user.id, naale_role: role })
    .select(STUDENT_COLUMNS)
    .single()

  if (created) return { status: 'ok', user, role, student: created as Student }

  // 23505 = unique_violation on students.auth_user_id — two first-login
  // requests raced (e.g. a double-clicked sign-in). The other one won and the
  // row now exists, so re-read instead of failing the request.
  if (error?.code === '23505') {
    const { data: raced } = await db
      .from('students')
      .select(STUDENT_COLUMNS)
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (raced) return { status: 'ok', user, role, student: raced as Student }
  }

  throw new Error(`failed to provision naale student: ${error?.message}`)
}

export type NaaleStaffResult =
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'ok'; user: User; student: Student }

/**
 * Staff-only gate for the Naale track. Counselors and teachers share the single
 * 'staff' role (identical permissions, per the spec), so this is a plain role
 * check with no further capability tiers.
 *
 * Returns 'forbidden' for a Naale *student* — students see only their own stats
 * via /api/naale/my-stats, never each other's.
 */
export async function requireNaaleStaff(): Promise<NaaleStaffResult> {
  const session = await getNaaleSession()
  if (session.status === 'unauthenticated') return { status: 'unauthenticated' }
  if (session.status === 'not_on_roster') return { status: 'forbidden' }
  if (session.role !== 'staff') return { status: 'forbidden' }
  return { status: 'ok', user: session.user, student: session.student }
}
