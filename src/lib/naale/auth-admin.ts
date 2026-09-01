import { randomBytes } from 'crypto'
import type { createServiceClient } from '@/lib/supabase/service'
import type { User } from '@supabase/supabase-js'

type Db = ReturnType<typeof createServiceClient>

/**
 * Finds a Supabase Auth user by email address.
 *
 * There is no admin "get user by email" endpoint, so this pages through
 * listUsers(). Matching is case-insensitive because Supabase Auth lowercases
 * every email it stores while naale_roster does not — the same asymmetry that
 * makes getNaaleSession() look the roster up with `ilike`.
 *
 * Lives here rather than in either script because two of them need it
 * (create-naale-test-users.ts and set-naale-password.ts), and a lookup copied
 * into two places is a lookup that eventually disagrees with itself.
 *
 * Server/script only — this uses the service-role admin API. Never import it
 * into a client component.
 */
export async function findAuthUserByEmail(db: Db, email: string): Promise<User | null> {
  const target = email.toLowerCase()
  let page = 1
  const perPage = 200

  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const found = data.users.find(u => u.email?.toLowerCase() === target)
    if (found) return found

    // A short page means this was the last one.
    if (data.users.length < perPage) return null
    page++
  }
}

/**
 * Whether this account can be signed into with a password.
 *
 * "Has an account" and "has a password" are different questions, and
 * conflating them is a real bug: an account created by Google OAuth exists but
 * has no password at all, so skipping it as "already provisioned" would leave
 * that student unable to use the email/password option Idan asked for.
 *
 * `app_metadata.providers` is populated by listUsers(), so this needs no
 * extra round trip. Verified 2026-08-24 against the live project: a
 * script-created account reads ["email"], a Google account reads ["google"].
 */
export function hasPasswordIdentity(user: User): boolean {
  const providers = user.app_metadata?.providers
  return Array.isArray(providers) && providers.includes('email')
}

/**
 * Creates the Supabase Auth user for `email` if none exists, or resets the
 * password on the existing one — same account either way, since Auth is
 * keyed by email. Shared by scripts/set-naale-password.ts and
 * /api/naale/admin/roster/custom-account so the create-or-reset logic lives
 * in one place, not two that can drift.
 */
export async function issuePassword(db: Db, email: string, password: string): Promise<'created' | 'reset'> {
  const existing = await findAuthUserByEmail(db, email)
  if (existing) {
    const { error } = await db.auth.admin.updateUserById(existing.id, { password })
    if (error) throw error
    return 'reset'
  }

  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return 'created'
}

// Excludes visually ambiguous characters (0/O, 1/l/I) — this password gets
// read aloud or handwritten to a student, not copy-pasted from a manager.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generateRandomPassword(length = 10): string {
  return Array.from(randomBytes(length), b => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('')
}
