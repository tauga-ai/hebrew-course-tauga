import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleAdmin } from '@/lib/naale/auth'

async function guard() {
  const admin = await requireNaaleAdmin()
  if (admin.status === 'unauthenticated') return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (admin.status === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  return null
}

export async function GET() {
  const blocked = await guard()
  if (blocked) return blocked

  const db = createServiceClient()
  const { data } = await db.from('naale_roster').select('email, role, created_at').order('email', { ascending: true })
  return NextResponse.json({ roster: data ?? [] })
}

/**
 * Deletes a single roster entry — a deliberate, targeted action, not a bulk
 * clear. Unlike DELETE /api/naale/admin/admins, there's no "last row" guard:
 * an empty naale_roster blocks every student/staff login, but it does not
 * lock an admin out of /naale/admin (requireNaaleAdmin() never checks the
 * roster), so there's no equivalent lockout risk to guard against here.
 */
export async function DELETE(request: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const { email } = await request.json()
  const db = createServiceClient()
  const { error } = await db.from('naale_roster').delete().ilike('email', email)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
