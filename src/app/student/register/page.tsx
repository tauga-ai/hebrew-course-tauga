'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/dev-i18n'
import { GoogleIcon } from '@/components/ui/GoogleIcon'

const LANGUAGES = ['ערבית', 'רוסית'] as const

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const linkExpired = searchParams.get('error') === 'expired'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [classCode, setClassCode] = useState(searchParams.get('class_code') || '')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  async function handleGoogle() {
    setGoogleLoading(true)
    setError('')
    const supabase = createClient()
    const next = classCode.trim()
      ? `/student/complete-profile?class_code=${encodeURIComponent(classCode.trim())}`
      : '/student/complete-profile'
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (oauthError) {
      setError(t('שגיאה בהתחברות עם Google'))
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !password || !classCode.trim()) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?type=email&next=/menu`,
      },
    })

    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes('already registered')
          ? t('כתובת המייל הזו כבר רשומה, נסה/י להתחבר')
          : t('שגיאה בהרשמה')
      )
      setLoading(false)
      return
    }

    // This project requires email confirmation — signUp succeeds but returns
    // no session until the student clicks the link in their inbox. Full
    // name/class get re-entered at /student/complete-profile after they
    // confirm and log in (same flow Google sign-ins already go through).
    if (!data.session) {
      setAwaitingConfirmation(true)
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/student/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim(), class_code: classCode.trim() }),
      })
      const profileData = await res.json()
      if (!res.ok) throw new Error(profileData.error || t('שגיאה'))
      router.push('/menu')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('שגיאה ביצירת הפרופיל'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-primary-700 dark:text-primary-400 mb-2">{t('הרשמה')}</h1>
        <p className="text-center text-fg/60 mb-8 text-sm">{t('תרגול ניצנים: הבנת הנקרא')}</p>

        {linkExpired && (
          <p className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3 text-sm text-center mb-5">
            {t('הקישור לאישור פג תוקף, נסה/י להירשם שוב.')}
          </p>
        )}

        {awaitingConfirmation ? (
          <div className="text-center space-y-3">
            <p className="text-fg/80">
              {t('נשלח אליך מייל עם קישור לאישור החשבון. לאחר שתאשר/י, אפשר להתחבר.')}
            </p>
            <p className="text-sm text-fg/40">{t('לא קיבלת מייל? בדוק/י בתיקיית הספאם.')}</p>
            <a href="/student" className="inline-block text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mt-2">
              {t('חזרה להתחברות')}
            </a>
          </div>
        ) : (
        <>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2 border border-card-border rounded-lg py-2.5 font-medium text-fg/80 hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-50 mb-4"
        >
          <GoogleIcon />
          {googleLoading ? t('מעביר ל-Google...') : t('הרשמה עם Google')}
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px bg-card-border flex-1" />
          <span className="text-xs text-fg/40">{t('או, אם אין לך Google')}</span>
          <div className="h-px bg-card-border flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-fg/80 mb-1">{t('שם מלא')}</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full border border-card-border rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
              placeholder={t('הכנס/י את שמך המלא')}
              required
            />
          </div>

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
            <label htmlFor="password" className="block text-sm font-medium text-fg/80 mb-1">{t('סיסמה')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-card-border rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
              placeholder={t('לפחות 6 תווים')}
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg/80 mb-1">{t('באיזו שפה את/ה לומד/ת?')}</label>
            <div className="grid grid-cols-2 gap-3">
              {LANGUAGES.map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setClassCode(lang)}
                  className={`py-2.5 rounded-lg font-semibold border transition ${
                    classCode === lang
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-surface text-fg/80 border-card-border hover:border-primary-400'
                  }`}
                >
                  {t(lang)}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !classCode}
            className="w-full bg-primary-600 text-white font-semibold py-2.5 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? t('נרשם/ת...') : t('הרשמה')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/student" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
            {t('יש לך כבר חשבון? התחבר/י')}
          </a>
        </div>
        </>
        )}
      </div>
    </div>
  )
}

export default function StudentRegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
