'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/dev-i18n'
import { GoogleIcon } from '@/components/ui/GoogleIcon'

// Login only — registration lives at /student/register. Google is the
// primary path (most students have Gmail and it's already verified);
// email+password is the fallback for the few who don't.
export default function StudentLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogle() {
    setGoogleLoading(true)
    setError('')
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/student/complete-profile`,
      },
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
      setError(t('אימייל או סיסמה שגויים. אם נרשמת עם Google, יש להשתמש בכפתור Google.'))
      setLoading(false)
      return
    }

    // If this account has no `students` row yet, /menu's session hook
    // redirects further to /student/complete-profile — no need to check here.
    router.push('/menu')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-primary-700 dark:text-primary-400 mb-2">{t('תרגול ניצנים')}</h1>
        <p className="text-center text-fg/60 mb-8 text-sm">{t('הבנת הנקרא')}</p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2 border border-card-border rounded-lg py-2.5 font-medium text-fg/80 hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-50 mb-4"
        >
          <GoogleIcon />
          {googleLoading ? t('מעביר ל-Google...') : t('התחברות עם Google')}
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px bg-card-border flex-1" />
          <span className="text-xs text-fg/40">{t('או, אם אין לך Google')}</span>
          <div className="h-px bg-card-border flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-fg/80 mb-1">{t('מייל')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-card-border rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
              placeholder="name@example.com"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-fg/80">{t('סיסמה')}</label>
              <a href="/student/forgot-password" className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                {t('שכחת סיסמה?')}
              </a>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-card-border rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
              placeholder={t('סיסמה')}
              required
            />
          </div>

          {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white font-semibold py-2.5 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? t('מתחבר/ת...') : t('התחברות')}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <a href="/student/register" className="block text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
            {t('אין לך חשבון? הרשמה')}
          </a>
          <a href="/teacher/login" className="block text-xs text-fg/40 hover:text-fg/70">
            {t('כניסה למורה')}
          </a>
        </div>
      </div>
    </div>
  )
}
