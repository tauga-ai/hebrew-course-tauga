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
  const { data } = await db.from('naale_admins').select('email, created_at').order('created_at', { ascending: true })
  return NextResponse.json({ admins: data ?? [] })
}

export async function POST(request: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const { email } = await request.json()
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db.from('naale_admins').insert({ email: email.toLowerCase() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const { email } = await request.json()
  const db = createServiceClient()

  // Never allow the allowlist to go empty — that's a lockout with no in-app
  // way back in, only a manual DB fix.
  const { count } = await db.from('naale_admins').select('email', { count: 'exact', head: true })
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'cannot_remove_last_admin' }, { status: 409 })
  }

  const { error } = await db.from('naale_admins').delete().ilike('email', email)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
