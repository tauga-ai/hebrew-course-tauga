import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleAdmin } from '@/lib/naale/auth'

async function guard() {
  const admin = await requireNaaleAdmin()
  if (admin.status === 'unauthenticated') return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (admin.status === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  return null
}

/**
 * Grade assignment is keyed by naale_students.id (staff_id), not by roster
 * email — naale_roster has no id, and a staff member only gets a
 * naale_students row once they've logged in at least once (getNaaleSession()
 * auto-provisions it). So this also returns the current staff list from
 * naale_students, not just the grade map, so the admin UI has an id to act
 * on without separately correlating the roster's email list against it. A
 * staff member who has never logged in simply won't appear here yet — there
 * is nothing to assign a grade to until their account exists.
 */
export async function GET() {
  const blocked = await guard()
  if (blocked) return blocked

  const db = createServiceClient()
  const [{ data: staff }, { data: grades }] = await Promise.all([
    db.from('naale_students').select('id, full_name').eq('role', 'staff').order('full_name', { ascending: true }),
    db.from('naale_staff_grades').select('staff_id, grade'),
  ])

  const byStaff = new Map<string, string[]>()
  for (const row of grades ?? []) {
    byStaff.set(row.staff_id, [...(byStaff.get(row.staff_id) ?? []), row.grade])
  }

  return NextResponse.json({
    staff: (staff ?? []).map(s => ({ staffId: s.id, fullName: s.full_name })),
    staffGrades: Object.fromEntries(byStaff),
  })
}

/** Replaces one staff member's full grade set — simplest correct semantics
 *  for a small multi-select in the admin UI, no separate add/remove calls. */
export async function PUT(request: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const { staffId, grades } = await request.json()
  const db = createServiceClient()

  const { error: deleteError } = await db.from('naale_staff_grades').delete().eq('staff_id', staffId)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (Array.isArray(grades) && grades.length > 0) {
    const { error: insertError } = await db
      .from('naale_staff_grades')
      .insert(grades.map((grade: string) => ({ staff_id: staffId, grade })))
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
