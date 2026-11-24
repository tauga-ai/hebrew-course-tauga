import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isNaaleRosterStudent, postGoogleSignInTarget } from '@/lib/naale/roster-guard'

/**
 * OAuth (Google) callback. @supabase/ssr uses the PKCE flow: Google redirects
 * here with a `code` that must be exchanged server-side for a session before
 * any cookie exists — exchangeCodeForSession() does that exchange.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/student/complete-profile'
  if (!next.startsWith('/')) {
    next = '/student/complete-profile'
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Naale roster students who came in through the Hebrew-course login skip
      // its class-code page and go straight to Naale
      // (naale-students-land-in-hebrew-course).
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const db = createServiceClient()
        const { data: profile } = await db.from('students').select('id').eq('auth_user_id', user.id).maybeSingle()
        next = postGoogleSignInTarget(next, !!profile, await isNaaleRosterStudent(db, user.email))
      }
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/student?error=google_auth_failed`)
}
