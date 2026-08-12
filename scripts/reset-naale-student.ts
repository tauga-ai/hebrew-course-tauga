/**
 * Resets one Naale-track student back to "brand new" (0 topic levels,
 * 0 sessions) by email, so the placement flow (ticket 11) can be re-tested
 * from scratch, including the abandon-halfway case.
 *
 * Deletes, for the matched student only:
 *   - all naale_topic_levels rows
 *   - all naale_sessions rows (naale_answers cascades via FK, so those go too)
 *
 * Does NOT touch the students row, the auth user, or naale_roster — the
 * account keeps its name/login and just loses its Naale progress.
 *
 * Looked up by auth email rather than student name/id: students has no email
 * column, so this goes through auth.admin.listUsers() (paginated — the admin
 * API has no email filter) to find the auth user, then students.auth_user_id
 * to find the row, then confirms it's actually in the 'naale' class before
 * touching anything.
 *
 * DRY RUN by default: prints what would be deleted and stops. Pass --confirm
 * to actually delete.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/reset-naale-student.ts <email> [--confirm]
 */
import { createServiceClient } from '../src/lib/supabase/service'

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

async function main() {
  const email = process.argv[2]
  const confirm = process.argv.includes('--confirm')

  if (!email || email.startsWith('--')) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/reset-naale-student.ts <email> [--confirm]')
    process.exit(1)
  }

  const db = createServiceClient()

  const user = await findUserByEmail(db, email)
  if (!user) {
    console.error(`No auth user found for ${email}`)
    process.exit(1)
  }

  const { data: naaleClass } = await db.from('classes').select('id').eq('track', 'naale').maybeSingle()
  if (!naaleClass) {
    console.error("No 'naale' class row found — is migration_naale_track.sql applied?")
    process.exit(1)
  }

  const { data: student } = await db
    .from('students')
    .select('id, full_name, class_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!student) {
    console.error(`No students row for ${email} (auth user ${user.id})`)
    process.exit(1)
  }
  if (student.class_id !== naaleClass.id) {
    console.error(`${email} is not on the Naale track (class_id ${student.class_id}) — refusing to touch it.`)
    process.exit(1)
  }

  console.log(`Target: ${student.full_name} <${email}> (${student.id})`)

  const { count: levelCount } = await db.from('naale_topic_levels').select('id', { count: 'exact', head: true }).eq('student_id', student.id)
  const { count: sessionCount } = await db.from('naale_sessions').select('id', { count: 'exact', head: true }).eq('student_id', student.id)
  const { count: answerCount } = await db.from('naale_answers').select('id', { count: 'exact', head: true }).eq('student_id', student.id)

  console.log(`Would delete: ${levelCount} naale_topic_levels rows, ${sessionCount} naale_sessions rows (cascades to ${answerCount} naale_answers rows)`)

  if (!confirm) {
    console.log('\nDRY RUN — nothing deleted. Re-run with --confirm to actually delete.')
    return
  }

  const { error: levelsError } = await db.from('naale_topic_levels').delete().eq('student_id', student.id)
  if (levelsError) throw levelsError
  const { error: sessionsError } = await db.from('naale_sessions').delete().eq('student_id', student.id)
  if (sessionsError) throw sessionsError

  console.log('Done. Student is back to brand-new state (0 topic levels, 0 sessions).')
}

main()
