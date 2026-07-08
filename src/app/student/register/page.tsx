'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Google icon, inline so no extra asset/dependency is needed.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.26h2.92c1.71-1.57 2.69-3.88 2.69-6.63z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 010-3.42V4.96H.96a8.99 8.99 0 000 8.08l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

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
      setError('שגיאה בהתחברות עם Google')
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
          ? 'כתובת המייל הזו כבר רשומה, נסה/י להתחבר'
          : 'שגיאה בהרשמה'
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
      if (!res.ok) throw new Error(profileData.error || 'שגיאה')
      router.push('/menu')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת הפרופיל')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-primary-700 dark:text-primary-400 mb-2">הרשמה</h1>
        <p className="text-center text-fg/60 mb-8 text-sm">תרגול ניצנים: הבנת הנקרא</p>

        {linkExpired && (
          <p className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3 text-sm text-center mb-5">
            הקישור לאישור פג תוקף, נסה/י להירשם שוב.
          </p>
        )}

        {awaitingConfirmation ? (
          <div className="text-center space-y-3">
            <p className="text-fg/80">
              נשלח אליך מייל עם קישור לאישור החשבון. לאחר שתאשר/י, אפשר להתחבר.
            </p>
            <p className="text-sm text-fg/40">לא קיבלת מייל? בדוק/י בתיקיית הספאם.</p>
            <a href="/student" className="inline-block text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 mt-2">
              חזרה להתחברות
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
          {googleLoading ? 'מעביר ל-Google...' : 'הרשמה עם Google'}
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px bg-card-border flex-1" />
          <span className="text-xs text-fg/40">או, אם אין לך Google</span>
          <div className="h-px bg-card-border flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-fg/80 mb-1">שם מלא</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full border border-card-border rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
              placeholder="הכנס/י את שמך המלא"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-fg/80 mb-1">מייל</label>
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
            <label htmlFor="password" className="block text-sm font-medium text-fg/80 mb-1">סיסמה</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-card-border rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
              placeholder="לפחות 6 תווים"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg/80 mb-1">באיזו שפה את/ה לומד/ת?</label>
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
                  {lang}
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
            {loading ? 'נרשם/ת...' : 'הרשמה'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/student" className="text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400">
            יש לך כבר חשבון? התחבר/י
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
