import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleAdmin } from '@/lib/naale/auth'
import { issuePassword, generateRandomPassword } from '@/lib/naale/auth-admin'

const VALID_ROLES = ['student', 'staff']

export async function POST(request: Request) {
  const admin = await requireNaaleAdmin()
  if (admin.status === 'unauthenticated') return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (admin.status === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { email, role } = await request.json()
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }
  if (typeof role !== 'string' || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
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
    ? await db.from('naale_roster').update({ role }).eq('email', existing.email)
    : await db.from('naale_roster').insert({ email: normalizedEmail, role })
  if (rosterError) return NextResponse.json({ error: rosterError.message }, { status: 500 })

  const password = generateRandomPassword()
  const action = await issuePassword(db, rosterEmail, password)

  return NextResponse.json({
    email: rosterEmail,
    role,
    password,
    action,
    existed: !!existing,
    previousRole: existing?.role ?? null,
  })
}
