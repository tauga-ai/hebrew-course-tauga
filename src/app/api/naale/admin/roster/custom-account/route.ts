import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleAdmin } from '@/lib/naale/auth'
import { issuePassword, generateRandomPassword, findAuthUserByEmail } from '@/lib/naale/auth-admin'
import { COHORTS, GRADES } from '@/lib/naale/grades'

const VALID_ROLES = ['student', 'staff']

export async function POST(request: Request) {
  const admin = await requireNaaleAdmin()
  if (admin.status === 'unauthenticated') return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (admin.status === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { email, role, first_name, last_name, phone, grade, cohort, grades } = await request.json()
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }
  if (typeof role !== 'string' || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }

  // Student: one optional grade (+ Naale/Tzabarim group for 10th-11th).
  // Staff: 0-to-many grades, saved as their staff grades below.
  const studentGrade = typeof grade === 'string' && (GRADES as readonly string[]).includes(grade) ? grade : null
  const studentCohort =
    studentGrade && ['י', 'יא'].includes(studentGrade) && (COHORTS as readonly string[]).includes(cohort) ? cohort : null
  const staffGrades: string[] = Array.isArray(grades)
    ? [...new Set(grades.filter((g): g is string => typeof g === 'string' && (GRADES as readonly string[]).includes(g)))]
    : []

  // Optional (naale-admin-add-student-dialog) — the bulk importer already
  // tolerates a blank name/phone cell the same way, so this stays consistent
  // with that rather than requiring all three.
  const rosterFields = {
    first_name: typeof first_name === 'string' && first_name.trim() ? first_name.trim() : null,
    last_name: typeof last_name === 'string' && last_name.trim() ? last_name.trim() : null,
    phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
    ...(role === 'student' ? { grade: studentGrade, cohort: studentCohort } : {}),
  }

  // Lowercase before writing new rows — naale_roster.email is a case-sensitive
  // primary key while Supabase Auth lowercases everything, so a mixed-case
  // address here would silently create a second, unreachable roster row. See
  // the naale-test-account-cleanup ticket's Naale.CaseTest@Test.com finding.
  const normalizedEmail = email.toLowerCase()

  const db = createServiceClient()

  // A plain upsert only matches an EXACT literal string, so if an existing
  // row predates this lowercasing (a CSV import, a hand-written DB edit) and
  // has different casing, upserting the lowercased address would create a
  // second row for the same person instead of updating theirs — the exact
  // bug this route's own comment above is trying to prevent. ilike finds it
  // regardless of case, and the update targets that row's real casing.
  const { data: existingRows, error: lookupError } = await db
    .from('naale_roster')
    .select('email, role')
    .ilike('email', normalizedEmail)
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })

  const existing = existingRows?.[0] ?? null
  const rosterEmail = existing?.email ?? normalizedEmail

  const { error: rosterError } = existing
    ? await db.from('naale_roster').update({ role, ...rosterFields }).eq('email', existing.email)
    : await db.from('naale_roster').insert({ email: normalizedEmail, role, ...rosterFields })
  if (rosterError) return NextResponse.json({ error: rosterError.message }, { status: 500 })

  const password = generateRandomPassword()
  const action = await issuePassword(db, rosterEmail, password)

  // naale_staff_grades is keyed by naale_students.id, which normally only exists
  // after the first login — so create the (staff) row now to have an id to attach
  // the chosen grades to. getNaaleSession() finds it by auth_user_id and takes over.
  if (role === 'staff') {
    const authUser = await findAuthUserByEmail(db, rosterEmail)
    if (authUser) {
      const { data: row } = await db.from('naale_students').select('id').eq('auth_user_id', authUser.id).maybeSingle()
      let staffId = row?.id
      if (!staffId) {
        const fullName = [rosterFields.first_name, rosterFields.last_name].filter(Boolean).join(' ') || rosterEmail
        const { data: created, error: createError } = await db
          .from('naale_students')
          .insert({ auth_user_id: authUser.id, full_name: fullName, role: 'staff' })
          .select('id')
          .single()
        if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })
        staffId = created.id
      }
      await db.from('naale_staff_grades').delete().eq('staff_id', staffId)
      if (staffGrades.length > 0) {
        const { error: gradesError } = await db.from('naale_staff_grades').insert(staffGrades.map(g => ({ staff_id: staffId, grade: g })))
        if (gradesError) return NextResponse.json({ error: gradesError.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({
    email: rosterEmail,
    role,
    password,
    action,
    existed: !!existing,
    previousRole: existing?.role ?? null,
  })
}
