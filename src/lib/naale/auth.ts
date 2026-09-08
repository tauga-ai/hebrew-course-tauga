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
  /** `phone` is read live from naale_roster, not denormalized onto students
   *  (naale-profile-name-phone) — this function already queries the roster
   *  on every call for the role check, and phone has no other consumer
   *  anywhere in the app, so there's nothing to gain from also storing it on
   *  the shared students table (unlike naale_role, which other queries
   *  filter on directly). Keeps every genuinely Naale-only fact under a
   *  naale_ table instead of leaking onto the cross-track students table. */
  | { status: 'ok'; user: User; role: NaaleRole; student: Student; phone: string | null }

const NAALE_TRACK = 'naale'
const STUDENT_COLUMNS = 'id, full_name, class_id, created_at, lesson_group, naale_role, translation_lang'

/**
 * A Google identity's own name always wins (naale-profile-name-phone) — the
 * roster's first/last name exists mainly for password-login students, who
 * have no Google profile to pull a name from at all. Returns null (not a
 * fallback to email) when neither source has anything, so callers can tell
 * "resolved a real name" apart from "nothing to go on."
 */
export function resolveFullName(
  user: User,
  rosterFirstName: string | null | undefined,
  rosterLastName: string | null | undefined
): string | null {
  const googleName = (user.user_metadata?.full_name as string | undefined)?.trim()
  if (googleName) return googleName
  const rosterName = [rosterFirstName, rosterLastName].filter(Boolean).join(' ').trim()
  return rosterName || null
}

/**
 * Resolves a Naale-track caller from the Supabase session.
 *
 * Three things this does that getStudentFromSession() does not:
 *  1. Derives the role from naale_roster by email — the school's CSV is the
 *     only source of truth for who gets in and as what.
 *  2. Auto-provisions the students row on first login. This track has no
 *     /student/complete-profile step: the roster already vouches for the
 *     student, and the display name comes from their Google identity when
 *     they have one, or their naale_roster name otherwise (naale-profile-
 *     name-phone — mainly for password-login students, who have no Google
 *     identity to pull a name from at all).
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
  //
  // Case-insensitive on purpose: Supabase Auth always lowercases user.email
  // (verified empirically — creating a user with mixed-case input returns it
  // lowercased), but naale_roster.email is a plain varchar with no case
  // normalization enforced on write. A school-supplied CSV with any case
  // variation (e.g. "John.Doe@School.org") would otherwise lock out a
  // genuinely rostered student — confirmed live during Ticket 16's QA pass.
  // ilike with no wildcard characters (a valid email can't contain % or _
  // meaningfully) behaves as a case-insensitive exact match.
  const { data: rosterRow } = await db
    .from('naale_roster')
    .select('email, role, first_name, last_name, phone')
    .ilike('email', user.email)
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

    // Keep a few denormalized students columns in sync with the roster on
    // every login, not just at first creation — same reasoning for all
    // three: a change in naale_roster should take effect without a manual
    // backfill.
    const updates: Partial<Student> = {}

    // naale_role: without this, a role change in naale_roster (student
    // promoted to staff, say) takes effect for the SESSION's own role
    // (always read fresh above) but not for this column — and
    // /api/naale/staff/students filters on exactly this column, so a
    // promoted staff member would keep appearing in their own staff-facing
    // student list. Confirmed live during Ticket 16's QA pass.
    if (existing.naale_role !== role) updates.naale_role = role

    // full_name: only touch it if the CURRENT value is exactly the
    // email-fallback this function itself would have written (i.e. nothing
    // real was ever resolved for this student) AND the roster now has
    // something better to offer. This fixes the password-login "name is
    // literally my email address" gap the moment a real roster name shows
    // up, without ever overwriting a genuine Google name or anything a
    // future profile-edit feature might set.
    if (existing.full_name === user.email) {
      const resolved = resolveFullName(user, rosterRow.first_name, rosterRow.last_name)
      if (resolved) updates.full_name = resolved
    }

    const rosterPhone = rosterRow.phone ?? null

    if (Object.keys(updates).length > 0) {
      await db.from('students').update(updates).eq('id', existing.id)
      return { status: 'ok', user, role, student: { ...existing, ...updates } as Student, phone: rosterPhone }
    }

    return { status: 'ok', user, role, student: existing as Student, phone: rosterPhone }
  }

  const fullName = resolveFullName(user, rosterRow.first_name, rosterRow.last_name) || user.email
  const rosterPhone = rosterRow.phone ?? null

  const { data: created, error } = await db
    .from('students')
    .insert({
      full_name: fullName,
      class_id: naaleClass.id,
      auth_user_id: user.id,
      naale_role: role,
    })
    .select(STUDENT_COLUMNS)
    .single()

  if (created) return { status: 'ok', user, role, student: created as Student, phone: rosterPhone }

  // 23505 = unique_violation on students.auth_user_id — two first-login
  // requests raced (e.g. a double-clicked sign-in). The other one won and the
  // row now exists, so re-read instead of failing the request.
  if (error?.code === '23505') {
    const { data: raced } = await db
      .from('students')
      .select(STUDENT_COLUMNS)
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (raced) return { status: 'ok', user, role, student: raced as Student, phone: rosterPhone }
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

export type NaaleAdminResult =
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'ok'; user: User }

/**
 * Admin-only gate for the Naale track — independent of getNaaleSession().
 * An admin need not be a roster member or have a students row at all (e.g.
 * a content manager who never takes the practice track themselves), so this
 * checks naale_admins directly rather than layering on the roster check.
 */
export async function requireNaaleAdmin(): Promise<NaaleAdminResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { status: 'unauthenticated' }

  const db = createServiceClient()

  // Case-insensitive for the same reason as the naale_roster lookup above.
  const { data: adminRow } = await db
    .from('naale_admins')
    .select('email')
    .ilike('email', user.email)
    .maybeSingle()

  if (!adminRow) return { status: 'forbidden' }
  return { status: 'ok', user }
}
