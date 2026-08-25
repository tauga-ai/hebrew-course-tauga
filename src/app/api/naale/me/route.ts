import { NextResponse } from 'next/server'
import { getNaaleSession } from '@/lib/naale/auth'
import { createServiceClient } from '@/lib/supabase/service'

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

  // Google's profile photo, when Supabase's OAuth metadata has one. Naale
  // has no upload-your-own-photo feature, so this is display-only, never
  // stored — a stale/missing URL just falls back to an initials badge
  // client-side, same as any other Google account without a photo set.
  const avatarUrl =
    (session.user.user_metadata?.avatar_url as string | undefined) ??
    (session.user.user_metadata?.picture as string | undefined) ??
    null

  // Only checked once the roster check above already passed, so this stays
  // free for the common student/staff case and only costs an extra lookup
  // for a caller who's also a Naale admin (see requireNaaleAdmin(), which
  // handles the admin-only, non-roster-member case separately).
  const { data: adminRow } = await createServiceClient()
    .from('naale_admins')
    .select('email')
    .ilike('email', session.user.email ?? '')
    .maybeSingle()

  return NextResponse.json({
    role: session.role,
    student: {
      id: session.student.id,
      full_name: session.student.full_name,
      translation_lang: session.student.translation_lang ?? 'ru',
    },
    avatar_url: avatarUrl,
    is_admin: !!adminRow,
  })
}
