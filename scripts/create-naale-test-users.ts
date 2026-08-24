/**
 * Creates (or resets the password of) a fixed set of Naale-track test
 * accounts, so local QA doesn't need real Gmail accounts or a live Google
 * OAuth round-trip. See test-user.md for the credentials this produces —
 * gitignored, never commit it.
 *
 * These are TEST accounts specifically. To issue a password to a real roster
 * member, use scripts/set-naale-password.ts instead — it checks roster
 * membership first and won't invent rows. (The email/password form on
 * /naale/login is production UI as of the naale-password-login ticket, so
 * this script is no longer the only thing it serves.)
 *
 * Uses auth.admin.createUser({ email_confirm: true }) so no real inbox is
 * needed. Idempotent: an email that already has an auth user gets its
 * password reset instead of erroring, so re-running this after forgetting a
 * password just works. Also ensures each naale_roster row exists, since a
 * roster-less email would resolve to 'not_on_roster' regardless of how it
 * signed in.
 *
 * The naale students row is NOT created here — getNaaleSession()
 * auto-provisions it on first real login, same as it does for Google.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/create-naale-test-users.ts
 */
import { createServiceClient } from '../src/lib/supabase/service'
import { findAuthUserByEmail } from '../src/lib/naale/auth-admin'

const PASSWORD = 'Password123!'

const TEST_USERS: { email: string; role: 'student' | 'staff' }[] = [
  { email: 'naale_student1@test.com', role: 'student' },
  { email: 'naale_student2@test.com', role: 'student' },
  { email: 'naale_student3@test.com', role: 'student' },
  { email: 'naale_staff1@test.com', role: 'staff' },
  { email: 'naale_staff2@test.com', role: 'staff' },
  { email: 'naale_staff3@test.com', role: 'staff' },
]

async function ensureUser(db: ReturnType<typeof createServiceClient>, email: string, role: 'student' | 'staff') {
  const { error: rosterError } = await db
    .from('naale_roster')
    .upsert({ email, role }, { onConflict: 'email' })
  if (rosterError) throw rosterError

  const existing = await findAuthUserByEmail(db, email)

  if (existing) {
    const { error } = await db.auth.admin.updateUserById(existing.id, { password: PASSWORD })
    if (error) throw error
    console.log(`${email} (${role}) — auth user already existed (${existing.id}), password reset.`)
  } else {
    const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (error) throw error
    console.log(`${email} (${role}) — auth user created (${data.user.id}).`)
  }
}

async function main() {
  const db = createServiceClient()
  for (const { email, role } of TEST_USERS) {
    await ensureUser(db, email, role)
  }
  console.log(`\nDone. All accounts share the password: ${PASSWORD}`)
  console.log('Sign in at /naale/login using the dev-only form (NODE_ENV=development only). See test-user.md.')
}

main()
