import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Pages reachable with no session at all.
const PUBLIC_PATHS = new Set([
  '/',
  '/student',
  '/student/register',
  '/student/forgot-password',
  '/student/reset-password',
  '/student/complete-profile',
  '/teacher/login',
  '/naale/login',
  '/naale/not-authorized',
])

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * unauthenticated humans away from pages they can't use yet.
 *
 * This is UX ONLY — it is NOT the authorization boundary. Every API route
 * re-derives identity itself via getStudentFromSession()/requireTeacher();
 * a bug here must never be the only thing standing between a request and
 * someone else's data.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isApiRoute = pathname.startsWith('/api/')
  const isAuthExchange = pathname.startsWith('/auth/')

  if (!user && !isApiRoute && !isAuthExchange && !PUBLIC_PATHS.has(pathname)) {
    const target = pathname.startsWith('/teacher')
      ? '/teacher/login'
      : pathname.startsWith('/naale')
        ? '/naale/login'
        : '/student'
    return NextResponse.redirect(new URL(target, request.url))
  }

  // A Naale session must never land on a main-course page — not just be denied
  // its data. Scoped to skip /naale itself (nothing to redirect away from) and
  // /teacher (a separate, non-track role system) so this only runs for the
  // paths where it matters.
  if (
    user &&
    !isApiRoute &&
    !isAuthExchange &&
    !pathname.startsWith('/naale') &&
    !pathname.startsWith('/teacher')
  ) {
    const db = createServiceClient()
    const [{ data: student }, { data: naaleClass }] = await Promise.all([
      db.from('students').select('class_id').eq('auth_user_id', user.id).maybeSingle(),
      db.from('classes').select('id').eq('track', 'naale').maybeSingle(),
    ])
    if (student && naaleClass && student.class_id === naaleClass.id) {
      return NextResponse.redirect(new URL('/naale', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
