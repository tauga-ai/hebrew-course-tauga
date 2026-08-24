'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GoogleIcon } from '@/components/ui/GoogleIcon'
import { t } from '@/lib/dev-i18n'

/**
 * Both sign-in options, side by side and equally available — Idan's request,
 * 2026-08-24: "Each user will be able to choose how they want to log in."
 *
 * The email/password form used to be dev-only, on the reasoning that Google was
 * the deliberate identity check for the roster model. It isn't the gate:
 * getNaaleSession() resolves naale_roster by email regardless of HOW the caller
 * signed in, so a password grants nothing Google didn't. What Google was really
 * providing was account creation — and scripts/set-naale-password.ts now covers
 * that for roster members whose school address isn't a Google account.
 *
 * It also could not simply be un-gated by flipping NEXT_PUBLIC_DEBUG_MODE: that
 * same flag strips the server-side correct_answer guard and the session-length
 * guard for every visitor to the build.
 *
 * No "forgot password?" link, on purpose. Resetting by email needs production
 * SMTP, which isn't configured; linking to a flow that can't send mail is worse
 * than omitting it. A forgotten password is re-issued with the script above —
 * see .claude/ai-docs/docs/naale-password-login/issuing-credentials.md.
 */
export default function NaaleLoginPage() {
  const router = useRouter()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const busy = loading || googleLoading

  async function handleGoogle() {
    setGoogleLoading(true)
    setError('')
    const supabase = createClient()
    // /naale resolves the role via /api/naale/me and forwards to the student
    // home or the staff view — nobody picks a track by hand.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/naale` },
    })
    if (oauthError) {
      setError(t('שגיאה בהתחברות עם Google'))
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      // Deliberately covers both "wrong password" and "this address has no
      // password because it only ever used Google". Distinguishing them means
      // confirming out loud whether an address has an account, which is the
      // enumeration leak /student/forgot-password also refuses to introduce.
      setError(t('אימייל או סיסמה שגויים. אם נרשמת עם Google, יש להשתמש בכפתור Google.'))
      setLoading(false)
      return
    }
    router.push('/naale')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-primary-700 dark:text-primary-400 mb-2">{t('נעלה')}</h1>
        <p className="text-center text-fg/60 mb-8 text-sm">{t('תרגול עברית')}</p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 border border-card-border rounded-lg py-2.5 font-medium text-fg/80 hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-50"
        >
          <GoogleIcon />
          {googleLoading ? t('מעביר ל-Google...') : t('התחברות עם Google')}
        </button>

        {/* Neutral about which option is primary. The draft-prep login says
            "or, if you don't have Google", which frames password as a fallback
            — Idan asked for both to be a real choice. */}
        <div className="flex items-center gap-3 my-5">
          <div className="h-px bg-card-border flex-1" />
          <span className="text-xs text-fg/40">{t('או התחברות עם מייל וסיסמה')}</span>
          <div className="h-px bg-card-border flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-fg/80 mb-1 text-start">
              {t('מייל')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-card-border rounded-lg px-4 py-2.5 text-start focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
              placeholder="name@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-fg/80 mb-1 text-start">
              {t('סיסמה')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-card-border rounded-lg px-4 py-2.5 text-start focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
              required
            />
          </div>

          {/* aria-live so a failed attempt is announced, and a reserved height
              so the button doesn't jump when the message appears. The dev form
              needed neither — only we ever used it. */}
          <p aria-live="polite" className="text-red-500 dark:text-red-400 text-sm text-center min-h-5">
            {error}
          </p>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary-600 text-white font-semibold py-2.5 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? t('מתחבר/ת...') : t('התחברות')}
          </button>
        </form>
      </div>
    </div>
  )
}
