'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const linkExpired = searchParams.get('error') === 'expired'
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    // resetPasswordForEmail succeeds even for unknown emails by design
    // (anti-enumeration) — the UI must not distinguish the two cases.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=/student/reset-password`,
    })

    if (resetError) {
      setError('שגיאה בשליחת הבקשה — נסה/י שוב')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-blue-700 mb-2">שכחת סיסמה?</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">נשלח לך לינק לאיפוס במייל</p>

        {linkExpired && (
          <p className="text-amber-600 bg-amber-50 rounded-lg p-3 text-sm text-center mb-5">
            הקישור לאיפוס הסיסמה פג תוקף או כבר נוצל. אפשר לבקש קישור חדש כאן.
          </p>
        )}

        {sent ? (
          <div className="text-center space-y-3">
            <p className="text-gray-700">
              אם קיים חשבון עם המייל הזה, שלחנו אליו קישור לאיפוס הסיסמה.
            </p>
            <p className="text-sm text-gray-400">
              לא קיבלת מייל? בדוק/י בתיקיית הספאם. אם נרשמת עם Google — היכנס/י דרך כפתור Google בדף ההתחברות, אין לך סיסמה להתאפס.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'שולח/ת...' : 'שלח/י קישור לאיפוס'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <a href="/student" className="text-sm text-blue-600 hover:text-blue-700">
            חזרה להתחברות
          </a>
        </div>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
