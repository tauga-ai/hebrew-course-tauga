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

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [classCode, setClassCode] = useState(searchParams.get('class_code') || '')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

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
    })

    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes('already registered')
          ? 'כתובת המייל הזו כבר רשומה — נסה/י להתחבר'
          : 'שגיאה בהרשמה'
      )
      setLoading(false)
      return
    }

    // Email confirmation is OFF for this project, so signUp should return a
    // session immediately. If it doesn't, Supabase project settings changed
    // out from under us — surface that instead of silently failing.
    if (!data.session) {
      setError('ההרשמה בוצעה אך לא נוצר חיבור. נסה/י להתחבר.')
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
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-blue-700 mb-2">הרשמה</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">תרגול ניצנים — הבנת הנקרא</p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 mb-4"
        >
          <GoogleIcon />
          {googleLoading ? 'מעביר ל-Google...' : 'הרשמה עם Google'}
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px bg-gray-200 flex-1" />
          <span className="text-xs text-gray-400">או, אם אין לך Google</span>
          <div className="h-px bg-gray-200 flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="הכנס/י את שמך המלא"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מייל</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="name@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="לפחות 6 תווים"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">קוד כיתה</label>
            <input
              type="text"
              value={classCode}
              onChange={e => setClassCode(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="קוד שקיבלת מהמורה"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'נרשם/ת...' : 'הרשמה'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/student" className="text-sm text-blue-600 hover:text-blue-700">
            יש לך כבר חשבון? התחבר/י
          </a>
        </div>
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
