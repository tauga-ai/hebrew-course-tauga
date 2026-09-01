import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
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

  // Only checked here, not inside requireNaaleAdmin() itself, so the common
  // admin-only case pays no extra cost — this only matters for the rarer
  // account that's also on naale_roster (naale-admin-staff-nav-link), same
  // case-insensitive pattern getNaaleSession() already uses for this table.
  const { data: rosterRow } = await createServiceClient()
    .from('naale_roster')
    .select('role')
    .ilike('email', admin.user.email ?? '')
    .maybeSingle()

  return NextResponse.json({
    email: admin.user.email,
    full_name: fullName,
    avatar_url: avatarUrl,
    roster_role: rosterRow?.role ?? null,
  })
}
