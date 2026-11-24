import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * True when this email is on naale_roster as a STUDENT (naale-students-land-in-hebrew-course).
 * Such a person belongs on /naale, never in the main Hebrew-course onboarding, whose
 * class-code step either strands them or enrolls them in the wrong course.
 *
 * Staff are deliberately not matched: they sometimes test the other course.
 * Case-insensitive, like getNaaleSession(): ilike with no wildcards is an exact match.
 */
export async function isNaaleRosterStudent(
  db: SupabaseClient,
  email: string | null | undefined
): Promise<boolean> {
  if (!email) return false
  const { data } = await db.from('naale_roster').select('role').ilike('email', email).maybeSingle()
  return data?.role === 'student'
}

/**
 * Where a Google sign-in should land. Only the default Hebrew-course target is
 * rewritten, and only for a roster student with no Hebrew-course profile yet:
 * anyone who already has one (the dual-track accounts) keeps today's behavior,
 * and an explicit target such as /naale from the Naale login is never touched.
 */
export function postGoogleSignInTarget(next: string, hasProfile: boolean, rosterStudent: boolean): string {
  return next === '/student/complete-profile' && !hasProfile && rosterStudent ? '/naale' : next
}
