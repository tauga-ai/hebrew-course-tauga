'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GoogleIcon } from '@/components/ui/GoogleIcon'
import { t, debugMode } from '@/lib/dev-i18n'

export default function NaaleLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Dev-only fallback so local QA doesn't need a real Google OAuth
  // round-trip — never rendered unless NEXT_PUBLIC_DEBUG_MODE is true at
  // build time (dead-code eliminated otherwise, same as DevPanel). Real
  // students still only ever see the Google button below: per ticket 3,
  // Google is the deliberate identity check for the roster model, not just
  // a convenience. See scripts/create-naale-test-users.ts / test-user.md for
  // the account
  // this signs in as.
  const [devEmail, setDevEmail] = useState('')
  const [devPassword, setDevPassword] = useState('')
  const [devError, setDevError] = useState('')
  const [devLoading, setDevLoading] = useState(false)

  async function handleGoogle() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    // /naale resolves the role via /api/naale/me and forwards to the student
    // home or the staff view — the student never picks a track.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/naale` },
    })
    if (oauthError) {
      setError('שגיאה בהתחברות עם Google')
      setLoading(false)
    }
  }

  async function handleDevSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!devEmail.trim() || !devPassword) return
    setDevLoading(true)
    setDevError('')

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: devEmail.trim(),
      password: devPassword,
    })

    if (signInError) {
      setDevError(signInError.message)
      setDevLoading(false)
      return
    }
    router.push('/naale')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
        <h1 className="text-2xl font-bold text-primary-700 dark:text-primary-400 mb-2">{t('נעלה')}</h1>
        <p className="text-fg/60 mb-8 text-sm">{t('תרגול עברית')}</p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 border border-card-border rounded-lg py-2.5 font-medium text-fg/80 hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-50"
        >
          <GoogleIcon />
          {loading ? t('מעביר ל-Google...') : t('התחברות עם Google')}
        </button>

        {error && <p className="text-red-500 dark:text-red-400 text-sm mt-4">{error}</p>}

        {debugMode && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px bg-card-border flex-1" />
              <span className="text-xs text-fg/40">dev only</span>
              <div className="h-px bg-card-border flex-1" />
            </div>
            <form onSubmit={handleDevSubmit} className="space-y-3 text-right">
              <input
                type="email"
                value={devEmail}
                onChange={e => setDevEmail(e.target.value)}
                placeholder="test-user.md"
                className="w-full border border-card-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
                required
              />
              <input
                type="password"
                value={devPassword}
                onChange={e => setDevPassword(e.target.value)}
                placeholder="password"
                className="w-full border border-card-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
                required
              />
              <button
                type="submit"
                disabled={devLoading}
                className="w-full border border-card-border rounded-lg py-2 text-sm font-medium text-fg/80 hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-50"
              >
                {devLoading ? '...' : 'Sign in (dev)'}
              </button>
              {devError && <p className="text-red-500 dark:text-red-400 text-xs">{devError}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
