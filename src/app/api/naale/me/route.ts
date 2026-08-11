import { NextResponse } from 'next/server'
import { getNaaleSession } from '@/lib/naale/auth'

/**
 * Who the caller is on the Naale track, and where the client should send them.
 * `not_on_roster` is a 403 rather than a 401 so the client can tell "log in"
 * apart from "you logged in fine, but you're not on the school's list" — the
 * two need different pages, and there's no manual path picker to fall back on.
 */
export async function GET() {
  const session = await getNaaleSession()

  if (session.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (session.status === 'not_on_roster') {
    return NextResponse.json({ error: 'not_on_roster' }, { status: 403 })
  }

  return NextResponse.json({
    role: session.role,
    student: { id: session.student.id, full_name: session.student.full_name },
  })
}
