'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
      setError('שגיאה בעדכון הסיסמה — נסה/י לבקש קישור חדש')
      setLoading(false)
      return
    }

    router.push('/menu')
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-lg">טוען...</div>
      </div>
    )
  }

  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-red-600">הקישור לא בתוקף</h1>
          <p className="text-gray-600 text-sm">
            הקישור לאיפוס הסיסמה פג תוקף או כבר נוצל. אפשר לבקש קישור חדש.
          </p>
          <a
            href="/student/forgot-password"
            className="inline-block bg-blue-600 text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-blue-700 transition"
          >
            בקש/י קישור חדש
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-blue-700 mb-2">סיסמה חדשה</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">בחר/י סיסמה חדשה לחשבון שלך</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה חדשה</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">אימות סיסמה</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="הכנס/י שוב את הסיסמה"
              minLength={6}
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'מעדכן/ת...' : 'עדכון סיסמה'}
          </button>
        </form>
      </div>
    </div>
  )
}
