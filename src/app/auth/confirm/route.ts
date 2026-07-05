import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Redeems a Supabase email-OTP link — password reset (`type=recovery`) or
 * signup confirmation (`type=email`). Unlike the OAuth callback, these links
 * carry a `token_hash` + `type` (not a `code`) — redeemed with verifyOtp(),
 * which establishes a session for the redirect target to use (e.g.
 * updateUser({ password }) for recovery).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const isRecovery = type === 'recovery'
  let next = searchParams.get('next') ?? (isRecovery ? '/student/reset-password' : '/menu')
  if (!next.startsWith('/')) {
    next = isRecovery ? '/student/reset-password' : '/menu'
  }

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  const expiredTarget = isRecovery ? '/student/forgot-password' : '/student/register'
  return NextResponse.redirect(`${origin}${expiredTarget}?error=expired`)
}
