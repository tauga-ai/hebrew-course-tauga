import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Staff screens show the name the school gave us on the roster, not the
 * student's own display name (naale-staff-roster-names): a Google profile
 * name always wins in naale_students.full_name, so staff saw nicknames and
 * Russian names they couldn't match to a student.
 */

/** email (lower-cased) -> "first last". Rows with no name are left out, so a
 *  lookup miss means "nothing better than full_name". Selects name columns
 *  only — the roster's phone must never reach a staff payload. */
export async function loadRosterNames(db: SupabaseClient): Promise<Map<string, string>> {
  // ponytail: reads the whole roster (cohort-sized, ~125 rows); page it if it ever nears 1000.
  const { data } = await db.from('naale_roster').select('email, first_name, last_name')
  const names = new Map<string, string>()
  for (const r of data ?? []) {
    const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim()
    if (name) names.set((r.email as string).toLowerCase(), name)
  }
  return names
}

/** The student's own display name, for a small secondary line — null when it
 *  is the same as what staff already see, so the line never repeats itself. */
export function ownNameIfDifferent(shown: string, fullName: string): string | null {
  return shown === fullName ? null : fullName
}

/** Roster name when there is one, else the student's own display name. */
export function staffDisplayName(
  rosterNames: Map<string, string>,
  email: string | null | undefined,
  fullName: string
): string {
  return (email && rosterNames.get(email.toLowerCase())) || fullName
}
