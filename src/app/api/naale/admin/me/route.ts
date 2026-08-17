import { NextResponse } from 'next/server'
import { requireNaaleAdmin } from '@/lib/naale/auth'

/**
 * Who the caller is as a Naale admin — deliberately separate from
 * /api/naale/me, which requires a roster/students row an admin may not have.
 */
export async function GET() {
  const admin = await requireNaaleAdmin()
  if (admin.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (admin.status === 'forbidden') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const fullName = (admin.user.user_metadata?.full_name as string | undefined)?.trim() || admin.user.email
  const avatarUrl =
    (admin.user.user_metadata?.avatar_url as string | undefined) ??
    (admin.user.user_metadata?.picture as string | undefined) ??
    null

  return NextResponse.json({ email: admin.user.email, full_name: fullName, avatar_url: avatarUrl })
}
