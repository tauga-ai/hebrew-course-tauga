import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Password-reset email link. Unlike the OAuth callback, Supabase's reset
 * link carries a `token_hash` + `type` (not a `code`) — redeemed with
 * verifyOtp(), which establishes a recovery session for the redirect target
 * to call updateUser({ password }) against.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  let next = searchParams.get('next') ?? '/student/reset-password'
  if (!next.startsWith('/')) {
    next = '/student/reset-password'
  }

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/student/forgot-password?error=expired`)
}
