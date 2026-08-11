'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/dev-i18n'

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
      setError(t('שגיאה בשליחת הבקשה, נסה/י שוב'))
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-primary-700 dark:text-primary-400 mb-2">{t('שכחת סיסמה?')}</h1>
        <p className="text-center text-fg/60 mb-8 text-sm">{t('נשלח לך לינק לאיפוס במייל')}</p>

        {linkExpired && (
          <p className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3 text-sm text-center mb-5">
            {t('הקישור לאיפוס הסיסמה פג תוקף או כבר נוצל. אפשר לבקש קישור חדש כאן.')}
          </p>
        )}

        {sent ? (
          <div className="text-center space-y-3">
            <p className="text-fg/80">
              {t('אם קיים חשבון עם המייל הזה, שלחנו אליו קישור לאיפוס הסיסמה.')}
            </p>
            <p className="text-sm text-fg/40">
              {t('לא קיבלת מייל? בדוק/י בתיקיית הספאם. אם נרשמת עם Google, היכנס/י דרך כפתור Google בדף ההתחברות, אין לך סיסמה להתאפס.')}
            </p>
          </div>
        ) : (
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

            {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white font-semibold py-2.5 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {loading ? t('שולח/ת...') : t('שלח/י קישור לאיפוס')}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <a href="/student" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
            {t('חזרה להתחברות')}
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
