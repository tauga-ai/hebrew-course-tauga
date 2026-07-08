'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [validSession, setValidSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function check() {
      // /auth/confirm already redeemed the recovery link into a session
      // before landing here — if there's no user, the link was invalid,
      // already used, or this page was opened directly.
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setValidSession(!!user)
      setChecking(false)
    }
    check()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('הסיסמה חייבת להיות לפחות 6 תווים')
      return
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('שגיאה בעדכון הסיסמה, נסה/י לבקש קישור חדש')
      setLoading(false)
      return
    }

    router.push('/menu')
  }

  if (checking) return <LoadingSpinner />

  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-red-600 dark:text-red-400">הקישור לא בתוקף</h1>
          <p className="text-fg/70 text-sm">
            הקישור לאיפוס הסיסמה פג תוקף או כבר נוצל. אפשר לבקש קישור חדש.
          </p>
          <a
            href="/student/forgot-password"
            className="inline-block bg-primary-600 text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-primary-700 transition"
          >
            בקש/י קישור חדש
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-primary-700 dark:text-primary-400 mb-2">סיסמה חדשה</h1>
        <p className="text-center text-fg/60 mb-8 text-sm">בחר/י סיסמה חדשה לחשבון שלך</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-fg/80 mb-1">סיסמה חדשה</label>
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
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-fg/80 mb-1">אימות סיסמה</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border border-card-border rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
              placeholder="הכנס/י שוב את הסיסמה"
              minLength={6}
              required
            />
          </div>

          {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white font-semibold py-2.5 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? 'מעדכן/ת...' : 'עדכון סיסמה'}
          </button>
        </form>
      </div>
    </div>
  )
}
