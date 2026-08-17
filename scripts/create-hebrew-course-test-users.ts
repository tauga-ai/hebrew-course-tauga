/**
 * Creates (or resets the password of) a fixed set of draft-prep ("hebrew
 * course") test accounts, one per existing class, for local dev sign-in via
 * /student's real email/password fallback (not dev-gated — it's a genuine
 * production feature for students without Gmail, see src/app/student/page.tsx).
 *
 * Mirrors scripts/create-naale-test-users.ts's pattern, but for the other
 * track: these exist so track-isolation testing (ticket:
 * .claude/ai-docs/tickets/naale-track-isolation/) has real draft-prep
 * credentials to test with, instead of only Naale ones.
 *
 * Idempotent: an email that already has an auth user gets its password reset
 * instead of erroring. The students row is created directly here (unlike
 * Naale, which auto-provisions on first login) since the main course's normal
 * signup path requires a class join_code round-trip that a script can skip.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/create-hebrew-course-test-users.ts
 */
import { createServiceClient } from '../src/lib/supabase/service'

const PASSWORD = 'Password123!'

const TEST_USERS: { email: string; className: string }[] = [
  { email: 'hebrew_student_arabic@test.com', className: 'כיתה ערבית' },
  { email: 'hebrew_student_russian@test.com', className: 'כיתה רוסית' },
]

async function findUserByEmail(db: ReturnType<typeof createServiceClient>, email: string) {
  const target = email.toLowerCase()
  let page = 1
  const perPage = 200
  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find(u => u.email?.toLowerCase() === target)
    if (found) return found
    if (data.users.length < perPage) return null
    page++
  }
}

async function ensureUser(db: ReturnType<typeof createServiceClient>, email: string, className: string) {
  const { data: cls, error: classError } = await db
    .from('classes')
    .select('id, track')
    .eq('name', className)
    .single()
  if (classError) throw classError
  if (cls.track !== 'draft_prep') throw new Error(`${className} is track=${cls.track}, expected draft_prep`)

  const existing = await findUserByEmail(db, email)
  let authUserId: string

  if (existing) {
    const { error } = await db.auth.admin.updateUserById(existing.id, { password: PASSWORD })
    if (error) throw error
    authUserId = existing.id
    console.log(`${email} — auth user already existed (${authUserId}), password reset.`)
  } else {
    const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (error) throw error
    authUserId = data.user.id
    console.log(`${email} — auth user created (${authUserId}).`)
  }

  const { data: existingStudent } = await db
    .from('students')
    .select('id, class_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (existingStudent) {
    console.log(`${email} — students row already exists (class_id=${existingStudent.class_id}).`)
    return
  }

  const { error: insertError } = await db
    .from('students')
    .insert({ full_name: email, class_id: cls.id, auth_user_id: authUserId })
  if (insertError) throw insertError
  console.log(`${email} — students row created (class_id=${cls.id}, ${className}).`)
}

async function main() {
  const db = createServiceClient()
  for (const { email, className } of TEST_USERS) {
    await ensureUser(db, email, className)
  }
  console.log(`\nDone. All accounts share the password: ${PASSWORD}`)
  console.log('Sign in at /student using the real email/password form.')
}

main()
