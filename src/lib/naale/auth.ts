import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { NaaleRole, NaaleStudentProfile } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

export type NaaleSessionResult =
  | { status: 'unauthenticated' }
  /** Authenticated with Google, but the email is not on the school's roster.
   *  There is no manual path picker on this track, so this is a dead end by
   *  design — the UI must show a "contact your counselor" page. Never a crash,
   *  and never a silently-defaulted role. */
  | { status: 'not_on_roster'; user: User }
  /** `phone` is read live from naale_roster, not stored on naale_students
   *  (naale-profile-name-phone) — this function already queries the roster
   *  on every call for the role check, and phone has no other consumer
   *  anywhere in the app, so there's nothing to gain from also storing it. */
  | {
      status: 'ok'
      user: User
      role: NaaleRole
      student: NaaleStudentProfile
      phone: string | null
      /** Same value as student.translation_lang — a sibling field so callers
       *  that only care about the resolved language don't need to reach into
       *  `student` for it. */
      translationLang: 'ru' | 'ar'
      /** Whether issuePassword() has ever set a password for this account —
       *  see hasPasswordIdentity()'s doc comment (naale-password-profile-
       *  detection) for why Supabase's own app_metadata.providers can't be
       *  trusted alone for this. */
      passwordIssuedByAdmin: boolean
    }

const NAALE_STUDENT_COLUMNS = 'id, full_name, role, translation_lang, created_at, updated_at'

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
 * Two things this does that getStudentFromSession() does not:
 *  1. Derives the role from naale_roster by email — the school's CSV is the
 *     only source of truth for who gets in and as what.
 *  2. Auto-provisions the naale_students row on first login. This track has
 *     no /student/complete-profile step: the roster already vouches for the
 *     student, and the display name comes from their Google identity when
 *     they have one, or their naale_roster name otherwise (naale-profile-
 *     name-phone — mainly for password-login students, who have no Google
 *     identity to pull a name from at all).
 *
 * No cross-track check is needed here (naale-students-full-split): Naale
 * accounts live in their own naale_students table now, so a row existing
 * there at all already means "this is a Naale account" — there is no shared
 * `students` row a draft-prep account's cookie could collide with.
 *
 * Never call getStudentFromSession() from a Naale route — it resolves a
 * *different* table (students) and knows nothing about this one.
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
    .select('email, role, first_name, last_name, phone, password_issued_by_admin')
    .ilike('email', user.email)
    .maybeSingle()

  if (!rosterRow) return { status: 'not_on_roster', user }
  const role = rosterRow.role as NaaleRole
  const passwordIssuedByAdmin = rosterRow.password_issued_by_admin ?? false
  const rosterPhone = rosterRow.phone ?? null

  const { data: existing } = await db
    .from('naale_students')
    .select(NAALE_STUDENT_COLUMNS)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Keep role in sync with the roster on every login, not just at first
    // creation — a role change in naale_roster (student promoted to staff,
    // say) takes effect for the SESSION's own role (always read fresh above)
    // but not for this column otherwise — and /api/naale/staff/students
    // filters on exactly this column, so a promoted staff member would keep
    // appearing in their own staff-facing student list. Confirmed live
    // during Ticket 16's QA pass.
    const updates: Partial<NaaleStudentProfile> = {}
    if (existing.role !== role) updates.role = role

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

    if (Object.keys(updates).length > 0) {
      await db.from('naale_students').update(updates).eq('id', existing.id)
      const merged = { ...existing, ...updates } as NaaleStudentProfile
      return {
        status: 'ok', user, role, student: merged,
        phone: rosterPhone, translationLang: merged.translation_lang, passwordIssuedByAdmin,
      }
    }

    return {
      status: 'ok', user, role, student: existing as NaaleStudentProfile,
      phone: rosterPhone, translationLang: existing.translation_lang, passwordIssuedByAdmin,
    }
  }

  const fullName = resolveFullName(user, rosterRow.first_name, rosterRow.last_name) || user.email

  const { data: created, error } = await db
    .from('naale_students')
    .insert({ auth_user_id: user.id, full_name: fullName, role })
    .select(NAALE_STUDENT_COLUMNS)
    .single()

  if (created) {
    return {
      status: 'ok', user, role, student: created as NaaleStudentProfile,
      phone: rosterPhone, translationLang: created.translation_lang, passwordIssuedByAdmin,
    }
  }

  // 23505 = unique_violation on naale_students.auth_user_id — two first-login
  // requests raced (e.g. a double-clicked sign-in). The other one won and the
  // row now exists, so re-read instead of failing the request.
  if (error?.code === '23505') {
    const { data: raced } = await db
      .from('naale_students')
      .select(NAALE_STUDENT_COLUMNS)
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (raced) {
      return {
        status: 'ok', user, role, student: raced as NaaleStudentProfile,
        phone: rosterPhone, translationLang: raced.translation_lang, passwordIssuedByAdmin,
      }
    }
  }

  throw new Error(`failed to provision naale student: ${error?.message}`)
}

export type NaaleStaffResult =
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'ok'; user: User; student: NaaleStudentProfile }

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
